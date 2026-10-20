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
 *   (0.8) note names, wherever a note number goes: noteIsDown('C4'), midi.play('C#4', 0.8), midi.isDown('Eb3')
 *   noteNumber('C4') → 60 · noteName(61) → 'C#4' (noteName(61, { flats: true }) → 'Db4', { octave: false } → 'C#') ·
 *   noteFreq('A4') → 440 (Hz; noteFreq(69) too). C4 = 60, scientific pitch notation, as the course modules say; some
 *   software (Ableton, Yamaha) calls 60 "C3". notePressed(note, velocity) still gets the number.
 *   function notePressed(note, velocity) {}   function noteReleased(note) {}
 *   function knobMoved(n, value) {}           function faderMoved(n, value) {}
 *   function padPressed(n, velocity) {}       function padReleased(n) {}
 *   (a pad also calls notePressed, unless the sketch defines padPressed)
 * The microphone reads the same way (off until the sketch reads one of these, calls startMic(), or 🎹 → 🎤 is pressed):
 *   micLevel            0..1, how loud it sounds (dB; the room is 0, talking ≈ 0.5)    micIsOn, startMic(), stopMic(), micSensitivity(2)
 *   bass, mid, treble   0..1, the energy in 20–250 Hz, 250–2000 Hz, 2000–8000 Hz
 *   beat                true for one frame per beat — the way mouseIsPressed is true while pressed
 *   function beatDetected(level) {}           function kickDetected(level) {}   snareDetected, hatDetected
 *   (the analysis is @openav/audio, loaded from next to this file the first time; no p5.sound needed, none disturbed)
 * Sound, a drum machine and a timeline (nothing of them loads until the sketch calls one, or 🎹 → 🔊 / 🥁 is pressed):
 *   startSound('piano'), stopSound(), soundIsOn   every key, pad, the 🎹 on screen and a phone are heard (@openav/sound)
 *   startDrums('breakbeat', 120), stopDrums()     a 16-step × 4-lane machine on screen (@openav/drums); drumsAreOn
 *   startDrums("bd*4, [~ sd]*2, hh*8")            or one line of rhythm (@openav/pattern; the line shows over the grid, the
 *                                                 word that sounds lights up); a mistake shows a card and plays 'four on floor'
 *   startDrums('s("bd*4").fast(2)')               or a line copied from strudel.cc (s / sound, .fast, .slow; the rest is said)
 *   (0.7) a click on a cell rewrites the line, the line can be typed into and the cells follow; ↶ / ⌘Z undoes;
 *   Copy gives startDrums("…") back, "Open in Strudel" opens the line at strudel.cc; OAVp5.drums.src / .strudelUrl / .history
 *   function rhythmChanged(src, how) {}          the line changed (how: 'code' · 'cell' · 'type' · 'undo' · 'menu')
 *   drawRhythm(x, y, w, h, 'grid' | 'circle' | 'spiral')   the rhythm drawn on the canvas, so a recording has it too
 *   drumStep 0..15, drumBar 1, 2, 3 …, drumBpm    where the machine is
 *   drumPhase 0..1, beatPhase 0..1                how far through the bar / the beat, smoothly, as it is heard
 *   function drumHit(lane, velocity) {}           and each hit also calls kickDetected / snareDetected / hatDetected
 *   function barStarted(bar) {}                   function stepStarted(step, bar) {}   (beatDetected on kick and snare)
 *   cue(5, 'storm'), cue(1, 'calm', 8)            at bar 5 (every 8 bars) → function cueFired(name, bar) {}; cueName
 * Recording (nothing loads until ⏺ in the 🎹 panel is pressed or the sketch calls it):
 *   startRecording(), startRecording(10), stopRecording(), recordingIsOn     the canvas + what the sketch sounds like
 *   function recordingSaved(info) {}              info = { name, blob, url, format: 'mp4' | 'webm', seconds, bytes, … }
 *   (the canvas only, never the 🎹 or the cards; startSound(), the drums, the microphone and p5.sound 1.x mixed into one
 *   track; MP4 where the browser writes it, else WebM; downloaded when done, a share button on a phone; 📷 saves a PNG)
 * Values over time, the way TouchDesigner's CHOPs shape them (one call in draw(), nothing to declare; @openav/chop):
 *   lag(micLevel, 0.03, 0.4)                       follows a value: 0.03 s up, 0.4 s down (Lag CHOP) — a VU meter in one call
 *   env('kick', 0.01, 0.3)                        0..1 after each kick / snare / hat / beat / note / bar, or trigger('boom') (Trigger)
 *   speed(rate) · spring(value, 100, 6) · trail(value, 2) · slope(value) · count(beat, 4)          (Speed, Spring, Trail, Slope, Count)
 *   scope(value, 'label')                         a small oscilloscope in the corner (never in a recording) · drawTrail(values, x, y, w, h)
 * When something goes wrong (a blocked microphone, no Web MIDI, an error inside notePressed(), a sketch's own `let note`, a
 * knob that both OPC and the sketch read, sound waiting for a click) a small card beside the 🎹 says what, why and what to
 * press, in the page's language; 🩺 in the panel or OAVp5.check() is a check-up to screenshot.
 * Knob 1 is knob 1 on any controller OAV knows (MiniLab 3, LPD8, nanoKONTROL2, … 27 profiles); on one it doesn't,
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
 * Other programs (0.7). What a program plays INTO "OAV Virtual MIDI" — Strudel's .midi('OAV Virtual MIDI'), a WebMidi.js
 * sketch — is heard like a keyboard, at the timestamp it gave (midi.last.source 'virtual-out'), and never handed back out
 * of the virtual input. An external MIDI clock (24 a beat, start / continue / stop) moves drumPhase, beatPhase, drumBar,
 * drumBpm and a drum machine that is up (OAVp5.clock). link=<room> joins pages over the phone relay: what one page's
 * programs play, every other page in the room hears when it sounds there (OAVp5.link). On strudel.cc the names Strudel
 * owns (note, velocity, beat) are said once, MIDI waits for its midin(), the panel is compact. openaudiovisual.com/docs/#strudel
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
 *   hints     on | off (the cards beside the 🎹; the console says the same either way)     scope  on | off (scope()'s corner plot)
 *   record    on | nomic (the microphone stays out of recordings) | off (no ⏺ / 📷; startRecording() does nothing)
 *   recfps    30 | 60     reclimit  300 (seconds: one take stops by itself there)     title  a name for the files
 *   relay / room   the phone relay (wss://remote.cheyuwu.com/relay) and room (one per browser)
 *   drums     lookahead (hits handed to the audio clock ahead of time by a worker heartbeat) | frame (0.5's way: moved by
 *             the frames, the safety net)      drumlatency  auto (the output latency the browser reports) | a number of ms
 *   telemetry off | on — @openav/midi's one anonymous page-load hit (packages/midi/README "Telemetry")
 *   link      a room: pages with the same one hear each other's programs, over the relay   linkdelay  ms of extra buffer (0)
 *   clock     follow (an external MIDI clock moves drumPhase and the drums) | off
 *   strudel   auto (strudel.cc, or Strudel's functions on the page) | on | off      compact  on | off (the panel in a corner box)
 */
(function () {
  'use strict';
  var g = typeof window !== 'undefined' ? window : globalThis;
  var OAV_P5_VERSION = '0.8.2';   // (not `VERSION`: p5's friendly errors flag any declaration that shares a p5 name)
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
    record: opt('record', 'on') === 'off' ? 'off' : opt('record', 'on') === 'nomic' ? 'nomic' : 'on',
    recfps: Math.max(1, Math.min(60, Math.round(+opt('recfps', 30)) || 30)),
    reclimit: Math.max(1, +opt('reclimit', 300) || 300), title: opt('title', ''),
    drums: opt('drums', 'lookahead') === 'frame' ? 'frame' : 'lookahead',
    drumlatency: opt('drumlatency', 'auto') === 'auto' || !isFinite(parseFloat(opt('drumlatency', 'auto'))) ? 'auto' : Math.max(0, Math.min(500, parseFloat(opt('drumlatency', 'auto')))) / 1000,
  };
  // OpenProcessing's console floats over the bottom of the sketch, so there the 🎹 and its panel live at the top
  var onOP = false;
  try { onOP = /(^|\.)openprocessing\.org$/.test(g.location.hostname); } catch (e) { /* */ }
  O.dock = opt('dock', onOP ? 'top' : 'bottom') === 'top' ? 'top' : 'bottom';
  O.corner = opt('corner', onOP ? 'left' : 'right') === 'left' ? 'left' : 'right';   // OpenProcessing puts OPC's icon top-right
  // 0.7 — other programs: an external MIDI clock to follow, a room to link pages in, and Strudel as a neighbour.
  // strudel.cc (or a page where Strudel's own functions are already there: note() and s() with stack() or samples()) is a
  // live-coding editor, not a sketch: the names it owns are said once, MIDI waits for its midin() to ask, the panel is
  // the compact one. We only look at the address and at what the page's globals are; nothing of Strudel is called.
  var onStrudel = false;
  try {
    onStrudel = opt('strudel', 'auto') === 'on' || (opt('strudel', 'auto') !== 'off' && (/(^|\.)strudel\.cc$/.test(g.location.hostname) ||
      (typeof g.note === 'function' && typeof g.s === 'function' && (typeof g.stack === 'function' || typeof g.samples === 'function'))));
  } catch (e) { /* */ }
  if (onStrudel && opt('hardware', null) == null) O.hardware = 'click';   // Strudel's midin() asks for MIDI; not us at load
  O.compact = opt('compact', onStrudel ? 'on' : 'off') === 'on';          // the panel as a box in the corner, a third of the height
  // how far from the window's edge the 🎹 sits: in Strudel above its side panel's bottom row (import · export · save)
  var EDGE = onStrudel && O.dock === 'bottom' ? 46 : 10;
  O.clock = opt('clock', 'follow') === 'off' ? 'off' : 'follow';          // follow an external MIDI clock (start / stop / tempo)
  O.link = String(opt('link', '')).replace(/[^\w-]/g, '').slice(0, 32);   // a room: pages in it hear each other's programs
  O.linkdelay = Math.max(0, Math.min(2000, parseFloat(opt('linkdelay', 0)) || 0));   // ms of extra buffer on a linked page's notes
  var DEBUG = opt('debug', '') !== '' && opt('debug', '') !== '0';   // ?debug=1: say in the console what the 🎹 sees
  function dbg() { if (DEBUG && g.console) console.log.apply(console, ['[oav-p5 debug]'].concat([].slice.call(arguments))); }
  // OpenProcessing opens its console over the sketch for every console line (2026-10-20 哲宇：「不要用 p5 的 print，這會一直
  // 冒出來」). There, what oav-p5 says on its own (the wiring, a hint that is already on a card, "sound on") stays off the
  // console; an error in your code, a call you made wrong, and 🩺 OAVp5.check() still print. debug brings everything back.
  var QUIET = onOP && !DEBUG;
  function sayInfo() { if (!QUIET && g.console) console.info.apply(console, arguments); }
  var profileChosen = opt('profile', null) != null;   // nobody chose ⇒ the panel follows the controller that is plugged in
  var zh = /^zh/i.test((g.navigator && g.navigator.language) || '');
  var T = zh
    ? { btn: 'MIDI：接鍵盤、按螢幕上的控制器，或用手機彈', phone: '📱 手機', close: '收起', hwOff: '沒接 MIDI 裝置', knob: '旋鈕', fader: '推桿', pad: '打擊墊',
        hwNone: '這個瀏覽器沒有 Web MIDI（Safari）：用螢幕上的控制器或手機', hwDenied: 'MIDI 權限被擋下了：網址列左邊可以重新允許',
        scan: '用手機掃描，打開 MIDI 分頁就能彈這個作品', room: '房間', wired: '接線', opcMark: '（OPC）', readOnly: '{read}（草圖）', readSlider: '{read}（草圖；{opc} 改用滑桿）', loading: '載入控制器中…（第一次要幾秒）',
        opMidi: 'OpenProcessing 的 OPC MIDI 對應開著：實體控制器交給它，OAV 只接螢幕上的控制器和手機',
        micOn: '🎤 開麥克風', micOff: '🎤 關麥克風', micAsking: '🎤 等你允許麥克風…', micDenied: '🎤 麥克風被擋下，再試一次', micDeniedHint: '網址列左邊可以重新允許，然後按這個鈕', micNone: '🎤 這裡拿不到麥克風（要 https 或 localhost）',
        micHint: 'micLevel、bass、mid、treble、beat',
        sndOn: '🔊 開聲音', sndOff: '🔊 關聲音', sndLoading: '🔊 載入聲音中…', sndWaiting: '🔊 點一下就有聲音', sndError: '🔊 聲音沒載到，再按一次',
        sndHint: '點一下畫面（或按一個鍵）就聽得到：瀏覽器要網頁被點過才讓它出聲', drumsOn: '🥁 鼓機', drumsOff: '🥁 關鼓機', fold: '收起格子', closeDrums: '關掉鼓機', check: '🩺 體檢',
        recOn: '⏺ 錄影', recStop: '⏹ 停止 {t}', recStarting: '⏺ 準備中…', recSaving: '⏺ 存檔中…', recTitle: '錄下畫布和作品的聲音（MP4，IG 可以直接用；🎹 和提示不會進影片）',
        recDot: '錄影中：按這裡停止', shot: '📷 存圖', shotTitle: '把畫布存成一張 PNG（不含 🎹 和提示）', share: '分享', download: '下載',
        fromOAV: '來自 OAV 鼓機（openaudiovisual.com）',
        place: { bottom: '位置：下方', top: '位置：上方', float: '位置：浮動' }, placeTitle: '面板放在下方、上方，或浮動（浮動時拖曳這一列就能移動）；這個瀏覽器會記住',
        size: '大小：', sizes: ['小', '中', '大'], sizeTitle: '面板的高度：小、中、大；這個瀏覽器會記住' }
    : { btn: 'MIDI: plug in a controller, play the one on screen, or use a phone', phone: '📱 Phone', close: 'Hide', hwOff: 'No MIDI device', knob: 'knob', fader: 'fader', pad: 'pad',
        hwNone: 'No Web MIDI in this browser (Safari): use the on-screen controller or a phone',
        hwDenied: 'MIDI permission is blocked: allow it again from the address bar', scan: 'Scan with a phone, open the MIDI tab and play this sketch', room: 'Room', wired: 'Wiring', opcMark: ' (OPC)', readOnly: '{read} (sketch)', readSlider: '{read} (sketch; {opc} by its slider)', loading: 'Loading the controller… (a few seconds the first time)',
        opMidi: "OpenProcessing's own OPC MIDI mapping is on: hardware is left to it; OAV wires the on-screen controller and the phone",
        micOn: '🎤 Turn on microphone', micOff: '🎤 Turn off microphone', micAsking: '🎤 Waiting for you to allow the microphone…', micDenied: '🎤 Blocked: try again', micDeniedHint: 'Allow the microphone again from the address bar, then press this button', micNone: '🎤 No microphone here (needs https or localhost)',
        micHint: 'micLevel, bass, mid, treble, beat',
        sndOn: '🔊 Turn on sound', sndOff: '🔊 Turn off sound', sndLoading: '🔊 Loading sound…', sndWaiting: '🔊 Click to hear', sndError: '🔊 Sound did not load: try again',
        sndHint: 'click the page (or press a key) once to hear it: browsers let a page play audio only after a click', drumsOn: '🥁 Drums', drumsOff: '🥁 Stop drums', fold: 'Fold the grid', closeDrums: 'Stop the drum machine', check: '🩺 Check',
        recOn: '⏺ Record', recStop: '⏹ Stop {t}', recStarting: '⏺ Starting…', recSaving: '⏺ Saving…', recTitle: "Record the canvas and the sketch's sound (MP4, ready for Instagram; the 🎹 and the cards stay out)",
        recDot: 'Recording: click to stop', shot: '📷 Save image', shotTitle: 'Save the canvas as a PNG (without the 🎹 and the cards)', share: 'Share', download: 'Download',
        fromOAV: 'from the OAV drum machine (openaudiovisual.com)',
        place: { bottom: 'Dock: bottom', top: 'Dock: top', float: 'Dock: floating' }, placeTitle: 'The panel at the bottom, at the top, or floating (drag this bar to move it); this browser remembers',
        size: 'Size: ', sizes: ['S', 'M', 'L'], sizeTitle: "The panel's height: small, medium, large; this browser remembers" };

  if (onStrudel) {                                      // in Strudel there is no sketch: what reads a knob is "your code"
    T.readOnly = zh ? '{read}（你的程式）' : '{read} (your code)';
    T.readSlider = zh ? '{read}（你的程式；{opc} 改用滑桿）' : '{read} (your code; {opc} by its slider)';
  }
  T.linkOn = '🔗 {room}';
  T.linkTitle = zh ? 'link 房間 {room}：{state}' : 'link room {room}: {state}';
  T.linkPeers = zh ? '另 {n} 頁' : '{n} other page(s)';
  T.linkAlone = zh ? '只有這頁' : 'no other page yet';
  T.linkWait = zh ? '連線中…' : 'connecting…';
  T.linkClosed = zh ? '斷線，重連中' : 'disconnected, retrying';
  T.clockChip = zh ? '⏱ 外部時鐘 {bpm} BPM' : '⏱ external clock {bpm} BPM';

  // ---------------------------------------------------------------- note names (0.8)
  // C4 = MIDI 60 (scientific pitch notation: A4 = 69 = 440 Hz; C-1 = 0, G9 = 127). Some software (Ableton Live, Yamaha)
  // calls 60 "C3": the number is the same, only the octave label differs, so a name from there is one octave off.
  // Written like Strudel's note("a3 c#4 e4"): a letter (any case), # for sharp or b for flat, then the octave.
  // Checked against the public page https://strudel.cc/learn/notes/ only (its example a3 c#4 e4 a4 = 57 61 64 69; "flats
  // with b and sharps with #"); Strudel's own source was not read. This parser is written from the MIDI standard.
  // Also accepted: ♯ and ♭, doubles (C##4, Ebb3), a number as a string ('60'), spaces around. A name that lands outside 0..127
  // (C-2, G#9) is a mistake, as is anything else that is not a note.
  var NOTE_PC = { c: 0, d: 2, e: 4, f: 5, g: 7, a: 9, b: 11 };
  var NOTE_SHARP = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  var NOTE_FLAT = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];
  function badNote(v) {
    var shown; try { shown = typeof v === 'string' ? '"' + v + '"' : String(v); } catch (e) { shown = '?'; }
    hint('noteBad:' + shown, 'noteBad', { v: shown }, 'error');   // the card beside the 🎹; the throw is the console's and p5's
    var t = H.noteBad;
    throw new Error('[oav-p5] ' + fill(t[0], { v: shown }) + (zh ? '。' : '. ') + fill(t[2], {}));
  }
  /** a note name or a number → the MIDI number 0..127 (a number is rounded and held to 0..127); anything else throws */
  function noteNumber(v) {
    if (typeof v === 'number') { if (v !== v || v === Infinity || v === -Infinity) badNote(v); return Math.max(0, Math.min(127, Math.round(v))); }
    if (typeof v !== 'string') badNote(v);
    var str = v.replace(/^\s+|\s+$/g, '');
    if (/^\d+(\.\d+)?$/.test(str)) return Math.max(0, Math.min(127, Math.round(+str)));
    var m = /^([a-gA-G])([#♯]*|[b♭]*)(-?\d+)$/.exec(str);
    if (!m) badNote(v);
    var acc = 0, a = m[2];
    for (var i = 0; i < a.length; i++) acc += (a[i] === '#' || a[i] === '♯') ? 1 : -1;
    var n = (parseInt(m[3], 10) + 1) * 12 + NOTE_PC[m[1].toLowerCase()] + acc;
    if (n < 0 || n > 127) badNote(v);
    return n;
  }
  /** a note number (or name) → 'C#4'; { flats: true } → 'Db4'; { octave: false } → 'C#' */
  function noteName(v, o) {
    var n = noteNumber(v), flats = !!(o && o.flats), oct = !(o && o.octave === false);
    return (flats ? NOTE_FLAT : NOTE_SHARP)[n % 12] + (oct ? Math.floor(n / 12) - 1 : '');
  }
  /** a note name or number → Hz (A4 = 69 = 440); a number may be fractional (69.5 is a quarter tone up) and is not held to 0..127 */
  function noteFreq(v) {
    var n = typeof v === 'number' ? v : noteNumber(v);
    if (n !== n || n === Infinity || n === -Infinity) badNote(v);
    return 440 * Math.pow(2, (n - 69) / 12);
  }
  // what the note-taking functions do with their argument: a name is parsed; anything else is exactly what 0.7 did (& 127)
  function noteArg(n) { return typeof n === 'string' ? noteNumber(n) : n & 127; }

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
    /** play as if a controller did: midi.play(60, 0.8) … midi.play(60, 0) releases; source 'screen'. A name works too: midi.play('C#4', 0.8) */
    play: function (note, velocity) { var v = Math.max(0, Math.min(127, Math.round((velocity == null ? 1 : velocity) * 127))); input([v > 0 ? 0x90 : 0x80, noteArg(note), v], 'screen'); },
    /** is this key down? a number or a name: midi.isDown('C4') (the same as noteIsDown) */
    isDown: function (n) { return midi.note[noteArg(n)] > 0; },
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
  var owned = {}, yielded = [];                       // yielded: names the page had before us (Strudel's note, beat …)
  function claim(name, value) { if (typeof g[name] === 'undefined') { setGlobal(name, value); if (g[name] === value) owned[name] = { v: value }; } else yielded.push(name); }
  function put(name, value) {
    if (readers[name]) {                               // knob1 & co. are read through a getter: only check who owns the name
      var d = Object.getOwnPropertyDescriptor(g, name);
      if (!d || !d.get) { delete readers[name]; ownName(name); return; }   // the sketch assigned its own knob1 = …
      if (!lex[name]) { lex[name] = true; if (shadowed(name)) ownName(name); }
      return;
    }
    var o = owned[name];
    if (!o) { if (Object.prototype.hasOwnProperty.call(GLOBALS, name) || /^(knob|fader|pad)\d+$/.test(name)) ownName(name); return; }
    if (g[name] !== o.v) { delete owned[name]; ownName(name); return; }
    setGlobal(name, value); o.v = value;
    if (!lex[name]) { lex[name] = true; if (shadowed(name)) ownName(name); }
  }
  // A `let note` (or const, class) in the sketch is no property of window, so what we write there is never what the sketch
  // reads, and nothing tells the student why `note` stays put. An indirect eval resolves a name the way the sketch does
  // (its own let first, then window): once per name, the first time we write it, we look whether that reaches us.
  var lex = {}, probing = false, probeHit = false;
  function shadowed(name) {
    if (typeof g.eval !== 'function') return false;
    var d = Object.getOwnPropertyDescriptor(g, name), mark = {};
    probing = true; probeHit = false;
    try {
      if (d && d.get) { (0, g.eval)(name); return !probeHit; }
      g[name] = mark;
      return (0, g.eval)(name) !== mark;
    } catch (e) { return !!e && e.name === 'ReferenceError'; }   // a let not initialized yet
    finally { probing = false; if (d && !d.get) g[name] = d.value; }
  }
  var ALT = { note: 'midi.last.note', velocity: 'midi.last.value', noteIsPressed: 'midi.held.length > 0', micIsOn: "OAVp5.mic.state === 'on'",
    soundIsOn: "OAVp5.sound.state === 'on'", drumsAreOn: "OAVp5.drums.state === 'on'", drumStep: 'OAVp5.drums.step', drumBar: 'OAVp5.drums.bar',
    drumBpm: 'OAVp5.drums.bpm', cueName: 'OAVp5.drums.lastCue', recordingIsOn: "OAVp5.record.state === 'on'" };
  function ownName(name) {
    if (onStrudel && yielded.indexOf(name) >= 0) return;   // said once at load, in Strudel's words (strudelNames)
    var m = /^(knob|fader|pad)(\d+)$/.exec(name);
    hint('own:' + name, 'ownName', { name: name, alt: m ? m[1] + '(' + m[2] + ')' : ALT[name] || 'OAVp5' }, 'info');
  }
  // in Strudel: what to read instead of a name Strudel already has
  var STRUDEL_ALT = { note: 'OAVp5.last.note', velocity: 'OAVp5.last.value', beat: "OAVp5.mic.on('beat', fn)", noteIsPressed: 'OAVp5.held.length > 0',
    bass: 'OAVp5.mic.bass', mid: 'OAVp5.mic.mid', treble: 'OAVp5.mic.treble', micLevel: 'OAVp5.mic.level' };
  var GLOBALS = { note: 0, velocity: 0, noteIsPressed: false, micIsOn: false,
    soundIsOn: false, drumsAreOn: false, drumStep: 0, drumBar: 0, drumBpm: 112, cueName: '', recordingIsOn: false,
    // 0.8.2 (2026-10-20 哲宇：「我想要一些 last 系列 ts，e.g. lastKickTs、lastSnareTs」): when the last hit came, on p5's millis()
    // clock, so `millis() - lastKickTs` is how many ms ago; -Infinity until the first one (millis() - it is Infinity)
    lastBeatTs: -Infinity, lastKickTs: -Infinity, lastSnareTs: -Infinity, lastHatTs: -Infinity, lastNoteTs: -Infinity };
  function hitTs() { try { if (typeof g.millis === 'function') { var t = g.millis(); if (typeof t === 'number' && t === t) return t; } } catch (e) { /* */ } return clock(); }
  var TS_OF = { beat: 'lastBeatTs', kick: 'lastKickTs', snare: 'lastSnareTs', hat: 'lastHatTs' };
  // knob1 … knob8, fader1 … fader8, pad1 … pad16 are readers, like the microphone's names: reading one says the sketch
  // plays from that control (so its MIDI troubles are worth a hint, and an OPC slider on the same knob steps aside)
  var readers = {}, READ = {};
  function ctlName(kind, n) {
    var name = kind + n;
    if (typeof g[name] !== 'undefined') { yielded.push(name); return; }   // the sketch's own (a var with a value, a function): ownName() on first use
    try {
      Object.defineProperty(g, name, {
        configurable: true, enumerable: false,
        get: function () { if (probing) probeHit = true; else if (!READ[name]) sketchRead(kind, n); return CTL[kind][n] || 0; },
        set: function (v) { Object.defineProperty(g, name, { value: v, writable: true, configurable: true, enumerable: true }); },
      });
      readers[name] = true;
    } catch (e) { claim(name, 0); }                     // a `var knob1;` with no value: a plain variable we write, as before
  }
  var FUNCS = {
    knob: function (n) { n = n | 0; if (!READ['knob' + n]) sketchRead('knob', n); return CTL.knob[n] || 0; },
    fader: function (n) { n = n | 0; if (!READ['fader' + n]) sketchRead('fader', n); return CTL.fader[n] || 0; },
    pad: function (n) { n = n | 0; if (!READ['pad' + n]) sketchRead('pad', n); return CTL.pad[n] || 0; },
    noteIsDown: function (n) { return midi.note[noteArg(n)] > 0; },
    noteNumber: noteNumber, noteName: noteName, noteFreq: noteFreq,
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
      profilesLoading = load('packages/midi/profiles/index.js').then(function (m) { profiles = m.PROFILES || []; tables = {}; return profiles; },
        function (e) { sayInfo('[oav-p5] controller profiles did not load (' + (e && e.message) + '): unknown devices map knobs in the order you turn them'); profiles = []; return profiles; });
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
  // knobs → sliders in order, then the faders; pads → toggles and buttons in order. A control the sketch reads itself
  // (knob1 in draw()) is the sketch's: the OPC variable at that place is left to its own slider, so one knob never moves
  // two things at once without anyone saying so (sketchRead says so, once).
  function opcTarget(t, kind, n) { return READ[kind + n] ? null : opcPlace(t, kind, n); }
  function opcPlace(t, kind, n) {
    if (kind === 'pad') return opcOf(['toggle', 'button'])[n - 1] || null;
    var sliders = opcOf(['slider']);
    return sliders[(kind === 'fader' ? ((t && t.count.knob) || 0) : 0) + n - 1] || null;
  }
  function opcWiring(t) {
    var out = [], sliders = opcOf(['slider']), pads = opcOf(['toggle', 'button']), nKnob = (t && t.count.knob) || 8, nFader = (t && t.count.fader) || 0;
    sliders.forEach(function (s, i) { out.push({ control: i < nKnob ? 'knob' + (i + 1) : i < nKnob + nFader ? 'fader' + (i - nKnob + 1) : null, name: s.name }); });
    pads.forEach(function (s, i) { out.push({ control: 'pad' + (i + 1), name: s.name }); });
    return out.filter(function (w) { return w.control; }).map(function (w) { return READ[w.control] ? { control: w.control, name: w.name, sketch: true } : w; });
  }
  function ctlLabel(control) { var m = /^(\D+)(\d+)$/.exec(control); return m ? T[m[1]] + m[2] : control; }
  function sketchRead(kind, n) {
    var name = kind + n;
    READ[name] = true; midiUsed = true;
    midiTrouble();
    var x = O.opc !== 'off' && opcPlace(tableFor('screen'), kind, n);
    if (x) hint('both:' + name, 'knobBoth', { ctl: ctlLabel(name), read: name, opc: x.name }, 'warn');
    if (legend) { legend.textContent = wiringText(); legend.title = legend.textContent; }
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
    sayInfo('[oav-p5] ' + T.opMidi);
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
  // the sketch's own error: show it like p5 would (the console, with its stack), keep the MIDI loop alive, and say it on
  // the page too (a hint with the file and line), because nobody watches the console while playing
  var SKETCH_FNS = { beatDetected: 1, kickDetected: 1, snareDetected: 1, hatDetected: 1, drumHit: 1, barStarted: 1, stepStarted: 1, cueFired: 1, recordingSaved: 1, rhythmChanged: 1 };
  EVENTS.forEach(function (k) { SKETCH_FNS[k] = 1; });
  function report(name, e) {
    var mine = SKETCH_FNS[name] === 1;
    if (g.console) console.error('[oav-p5] ' + (mine ? (zh ? '你的 ' + name + '() 出錯了：' : 'error inside your ' + name + '():') : 'error inside ' + name + ':'), e);
    if (!mine) return;
    var msg = String((e && e.message) || e).slice(0, 140), w = whereIn(e);
    hint('err:' + name + ':' + msg, 'cbError', { name: name, msg: msg, where: w ? fill(H.at, { file: w.file, n: w.line }) : '',
      line: w ? fill(H.line, { n: w.line }) : (zh ? '出錯的那一行' : 'the line') }, 'error');
  }

  var virtualPort = null;                              // the shim's virtual input, once a sketch asked for Web MIDI
  // t: when it is heard (performance.now() ms; a hardware event's timeStamp, a program's send() timestamp), for the clock
  function input(data, source, dev, t) {
    if (!data || data.length < 1) return;
    var b0 = data[0] | 0, b1 = (data[1] | 0) & 127, b2 = (data[2] | 0) & 127;
    if (b0 >= 0xF8 || b0 === 0xF2) { clockIn(data, t, source); return; }   // clock, start / stop, song position: the clock's
    if (b0 < 0x80 || b0 >= 0xF0) return;               // sysex, running status: not for sketches
    var type = b0 & 0xF0, ch = (b0 & 0x0F) + 1, bytes = [b0, b1, b2];
    if (source === 'hardware') lastHw = clock();
    // hardware already reaches the sketch's own Web MIDI code; what a program played INTO the virtual output never goes
    // back out of the virtual input (Strudel's midin ↔ .midi('OAV Virtual MIDI') would play each other forever)
    if (source === 'link') linkHeard(bytes);             // before the program hears it: its echo is caught
    if (source !== 'hardware' && source !== 'virtual-out' && virtualPort) virtualPort.emit(bytes);
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
      if (on) { put('note', b1); put('velocity', v); put('lastNoteTs', hitTs()); }
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
  function setHardware(s) { midi.hardware = s; paintButton(); midiTrouble(); }
  // Safari has no Web MIDI, a refused permission keeps hardware out: say so to a sketch that plays from MIDI
  // (it defines notePressed() & co., or reads knob1 …), never to one that does not use MIDI at all
  var midiUsed = false;
  function usesMidi() {
    if (midiUsed) return true;
    for (var i = 0; i < EVENTS.length; i++) if (typeof g[EVENTS[i]] === 'function' || subs[EVENTS[i]].length) return (midiUsed = true);
    return false;
  }
  function midiTrouble() {
    if (midi.hardware !== 'denied' && midi.hardware !== 'unavailable') { unhint('midiDenied'); return; }
    if (!usesMidi()) return;
    if (!realRequest) hint('midiNone', null, null, 'info');
    else if (midi.hardware === 'denied') hint('midiDenied');
  }
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
      var onPort = function (e) { if (e === seen) return; seen = e; input(e.data, 'hardware', 'hw:' + name, e.timeStamp || e.receivedTime); };
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
      sayInfo('[oav-p5] no hardware MIDI here (' + (e && e.name) + ') — the 🎹 on-screen controller and a phone still play the sketch');
      asking = null;
      return false;
    });
    return asking;
  }

  // ---------------------------------------------------------------- the shim: sketches with their own Web MIDI code
  // Safari / iPad included: there the sketch gets the virtual port alone, so a WebMidi.js sketch still runs
  // (0.7) The virtual port has an OUTPUT of the same name too, and what a program plays into it is now heard: Strudel's
  // `.midi('OAV Virtual MIDI')` moves notePressed(), knob1, the pads, startSound()'s instrument, as a keyboard would.
  var vmod = null;
  if (O.shim !== 'off' && g.navigator) {
    nav.requestMIDIAccess = function (opts) {
      return load('packages/midi/virtual-access.js').then(function (m) {
        vmod = m;
        var make = function () {
          if (!virtualPort) virtualPort = m.createVirtualMIDIAccess({ name: 'OAV Virtual MIDI', manufacturer: 'open-audiovisual', id: 'oav-p5',
            onOutput: fromOutput, onClear: clearOutput });
          return virtualPort;
        };
        // the sketch's request asks for real ports too (its own permission prompt, its own answer)
        return m.virtualRequestMIDIAccess({ real: realRequest, make: make })(opts || {});
      });
    };
  }

  // ---------------------------------------------------------------- other programs: the virtual output, a clock, a link (0.7)
  // A program that plays out to "OAV Virtual MIDI" sends each message with a timestamp — Strudel 0.2–0.3 s before it
  // should sound, as it would to a hardware synth, which waits for that moment. So do we: a note is told to the sketch
  // (notePressed, knob1 …) when it sounds, not when it was sent (measured on strudel.cc: within 5 ms, median 0.2 ms). One queue, in time
  // order and then send order (a note-off and the next note-on 1 ms apart stay in that order). Clock messages go to the
  // clock at once, with their time: knowing a beat early is what lets the drums land on it.
  var ext = { out: 0, outLast: null, outAt: 0, echoes: 0 };   // for 🩺: what came out of the port, when, and the echoes held back
  var outQ = [], outTimer = null, outSeq = 0;
  function nowMs() { return clock(); }
  function fromOutput(bytes, ts) {
    var list = vmod && vmod.splitMidi ? vmod.splitMidi(bytes) : [Array.prototype.slice.call(bytes)];
    var now = nowMs(), t = typeof ts === 'number' && isFinite(ts) && Math.abs(ts - now) < 10000 ? ts : now;   // a timestamp on another clock: now
    for (var i = 0; i < list.length; i++) {
      var msg = list[i], s = msg[0];
      if (s >= 0xF0 && !(s >= 0xF8 || s === 0xF2)) continue;   // sysex & co.: not for sketches, not for a link
      ext.out++; ext.outLast = msg; ext.outAt = now;
      if (link && O.link) linkOut(msg, t);
      if (s >= 0xF8 || s === 0xF2) clockIn(msg, t, 'virtual-out');
      else later(msg, t, 'virtual-out');
    }
  }
  /** to the sketch at time t (performance.now() ms); now, if that is now or past and nothing waits before it */
  function later(msg, t, source) {
    if (t <= nowMs() + 0.5 && !outQ.length) { input(msg, source, null, t); return; }
    var x = { t: t, k: outSeq++, msg: msg, source: source }, i = outQ.length;
    while (i > 0 && (outQ[i - 1].t > t)) i--;              // stable: equal times keep the order they came in
    outQ.splice(i, 0, x);
    arm();
  }
  function arm() {
    if (outTimer) { clearTimeout(outTimer); outTimer = null; }
    if (!outQ.length) return;
    outTimer = setTimeout(drainOut, Math.max(0, outQ[0].t - nowMs()));
  }
  function drainOut() {
    outTimer = null;
    var now = nowMs();
    while (outQ.length && outQ[0].t <= now + 0.5) { var x = outQ.shift(); input(x.msg, x.source, null, x.t); }
    arm();
  }
  // Web MIDI's output.clear(): what waits is dropped — but a note-off still lands now, so no key is left held
  function clearOutput() {
    var keep = [], offs = [];
    outQ.forEach(function (x) { if (x.source !== 'virtual-out') keep.push(x); else if ((x.msg[0] & 0xF0) === 0x80 || ((x.msg[0] & 0xF0) === 0x90 && !x.msg[2])) offs.push(x); });
    outQ = keep; arm();
    offs.forEach(function (x) { input(x.msg, 'virtual-out', null, nowMs()); });
  }

  // ---- the external clock: 0xF8 ×24 a beat, start / continue / stop, from any input (Strudel's midicmd, a DAW, hardware,
  // a linked page). @openav/midi's MidiClock (packages/midi/clock.js) does the counting; here it drives:
  //   the drum machine, when the sketch started one (startDrums / 🥁): its tempo, where bar 1 starts and drumPhase follow
  //     the clock (DrumTransport.follow: a small error is pulled in by a slightly faster or slower tempo; a large one — the
  //     machine started on its own, a relocate — is a jump onto the external grid),
  //     an external stop stops it, a start starts it on the downbeat;
  //   without the machine: drumPhase, beatPhase, drumBar, drumStep and drumBpm read the external clock itself.
  // clock=off ignores it all. With no clock coming in nothing here runs: 0.6 exactly.
  var clk = null, clkModP = null, clkBuf = [], clkLoop = false, clkFixAt = -1e9, clkBpmFixed = 0, clkStopT = null, clkSaid = false;
  var clkInfo = { source: null };
  function clockIn(msg, t, source) {
    if (O.clock === 'off') return;
    var now = nowMs();
    if (!(typeof t === 'number' && isFinite(t)) || Math.abs(t - now) > 10000) t = now;
    clkInfo.source = source;
    if (!clk) {
      clkBuf.push([Array.prototype.slice.call(msg), t]);
      if (clkBuf.length > 4000) clkBuf.shift();
      if (!clkModP) clkModP = load('packages/midi/clock.js').then(function (m) {
        clk = new m.MidiClock();
        var b = clkBuf; clkBuf = [];
        for (var i = 0; i < b.length; i++) clockEvent(clk.feed(b[i][0], b[i][1] / 1000), b[i][1] / 1000);
      }, function () { clkModP = null; hint('modfail:clock', 'moduleFail', { name: '@openav/midi clock', host: hostOf(BASE) }, 'error'); });
      return;
    }
    clockEvent(clk.feed(msg, t / 1000), t / 1000);
  }
  midi.clock = {
    /** { state: 'none' | 'running' | 'stopped' | 'lost', bpm, running, following (the drums follow it), source, clocks, … } */
    get info() { var i = clk ? clk.info(nowMs() / 1000) : { state: 'none', bpm: null, running: false, clocks: 0 }; i.source = clkInfo.source; i.following = following(); return i; },
    get bpm() { return clk ? clk.bpm : null; },
    /** { pos, bar 0..1, beat 0..1, bpm, running } as heard now, or null */
    get phase() { return clk ? clk.phaseAt(nowMs() / 1000) : null; },
    _clock: function () { return clk; },
  };
  /** an external clock is there and moving (not stopped, not lost) */
  function following() { return !!clk && O.clock !== 'off' && clk.state(nowMs() / 1000) === 'running' && clk.bpm != null; }
  /** one that was stopped by its program (its position holds), still sending or not long gone */
  function stoppedClock() { return !!clk && O.clock !== 'off' && clk.state(nowMs() / 1000) === 'stopped' && clk.bpm != null; }
  function clockEvent(r, tSec) {
    if (!r || r === 'dupe' || r === 'spp') return;
    var m = drums.machine, seq = m && m.seq;
    if (!clkSaid && clk.bpm) { clkSaid = true; sayInfo('[oav-p5] ' + (zh ? '收到外部 MIDI 時鐘（' : 'an external MIDI clock (') + Math.round(clk.bpm) + ' BPM' + (zh ? '）：鼓機和 drumPhase 跟著它（clock=off 不跟）' : '): the drums and drumPhase follow it (clock=off: they do not)')); }
    runClock();
    if (r === 'start' || r === 'continue') {
      if (clkStopT) { clearTimeout(clkStopT); clkStopT = null; }
      if (seq && typeof seq.follow === 'function' && machineUp()) {
        if (seq.playing) seq.stop();
        var a = clk.anchor();
        seq.follow({ pos: a ? a.pos : 0, at: a ? a.at : tSec, bpm: clk.bpm ? r100(clk.bpm) : drums.bpm });
        clkFixAt = nowMs(); clkBpmFixed = clk.bpm || 0;
        playBox(m, true); setDrums('on'); showDrums(true); runDrums();
      }
      return;
    }
    if (r === 'stop') {
      if (clkStopT) clearTimeout(clkStopT);
      clkStopT = setTimeout(function () {                // at the moment it is heard, not when it was sent
        clkStopT = null;
        var mm = drums.machine;
        if (mm && mm.seq && mm.seq.playing && machineUp()) { mm.seq.stop(); playBox(mm, false); syncDrums(); }
      }, Math.max(0, tSec * 1000 - nowMs()));
      return;
    }
    // a clock: keep the machine on it — at once when it is not yet, then every quarter second or on a tempo change
    if (seq && typeof seq.follow === 'function' && seq.playing && machineUp() && clk.bpm && clk.running) {
      var now = nowMs(), moved = clkBpmFixed && Math.abs(clk.bpm - clkBpmFixed) / clkBpmFixed > 0.003;
      if (now - clkFixAt > 250 || moved || !seq.followInfo()) {
        var an = clk.anchor();
        if (an) { seq.follow({ pos: an.pos, at: an.at, bpm: r100(clk.bpm) }, { jump: 1 / 32 }); clkFixAt = now; clkBpmFixed = clk.bpm; }
      }
    } else if (seq && typeof seq.follow !== 'function' && m.setBpm && clk.bpm && Math.abs(clk.bpm - drums.bpm) > 0.5) {
      m.setBpm(Math.round(clk.bpm * 10) / 10);           // drums=frame: no clock to steer, the tempo at least
    }
  }
  // the machine is up (startDrums() or 🥁: playing, or stopped with its grid on screen): an external clock may move it
  // the tempo the machine gets: to a hundredth of a bpm (what drumBpm prints); the phase is steered anyway
  function r100(x) { return Math.round(x * 100) / 100; }
  function machineUp() { return drums.state === 'on' || drums.state === 'stopped'; }
  // the grid's own play checkbox says what the machine does (mountDrums' root is public)
  function playBox(m, on) { try { var b = m.root && m.root.querySelector('[data-play]'); if (b) b.checked = on; } catch (e) { /* */ } }
  // without the machine, the timeline names read the external clock; with it, a line on the drum card says who leads
  var followBadge = null;
  function runClock() {
    if (clkLoop) return;
    clkLoop = true;
    (function tick() {
      if (!clk || clk.state(nowMs() / 1000) === 'none') { clkLoop = false; return; }
      var on = following(), m = drums.machine, mine = m && m.seq && m.seq.playing;
      if (on && !mine) {
        var p = clk.phaseAt(nowMs() / 1000);
        if (p) { var n = Math.floor(p.pos * 16 + 1e-9); put('drumStep', n % 16); put('drumBar', Math.floor(p.pos + 1e-9) + 1); put('drumBpm', Math.round(clk.bpm * 10) / 10); }
      }
      paintFollow(on);
      raf(tick);
    })();
  }
  function paintFollow(on) {
    var show = on && drumCard && drums.machine && machineUp();
    if (show && !followBadge) {
      followBadge = el('div', 'margin-top:4px;font:600 11.5px system-ui,sans-serif;color:#9fd8ff;font-variant-numeric:tabular-nums');
      followBadge.id = 'oav-p5-follow';
      drumCard.appendChild(followBadge);
    }
    if (followBadge) {
      followBadge.style.display = show ? '' : 'none';
      if (show) {
        var b = Math.round(clk.bpm * 10) / 10, txt = fill(zh ? '⏱ 跟著外部時鐘 · {bpm} BPM' : '⏱ following an external clock · {bpm} BPM', { bpm: b });
        if (followBadge.textContent !== txt) {
          followBadge.textContent = txt;
          // the grid's own tempo slider and number say the same (mountDrums' root is public; its slider is left alone otherwise)
          try { var r = drums.machine.root, sl = r && r.querySelector('[data-bpm]'), nv = r && r.querySelector('[data-bpmv]'); if (sl) sl.value = Math.round(b); if (nv) nv.textContent = Math.round(b); } catch (e) { /* */ }
        }
      }
    }
    paintExt();
  }
  // the 🎹 grows a 🔗 while linked (green: another page is there; yellow: connecting or alone; red: the relay is gone), and the
  // panel's bar says the room, the other pages and the trip; ⏱ and the tempo while an external clock leads
  var extChip = null, extText = '';
  function paintExt() {
    var L = O.link ? (linkState || { state: link ? 'connecting' : 'off', peers: 0 }) : null;
    if (L && btn && btn.querySelector) {
      var dot = btn.querySelector('#oav-p5-link-dot');
      if (!dot) { dot = el('span', 'font-size:12px;line-height:1;border-bottom:2px solid #e0c25f'); dot.textContent = '🔗'; dot.id = 'oav-p5-link-dot'; btn.appendChild(dot); }
      dot.style.borderBottomColor = L.state === 'open' ? (L.peers ? '#5fe08a' : '#e0c25f') : L.state === 'closed' ? '#e06b5f' : '#e0c25f';
      dot.title = fill(T.linkTitle, { room: O.link, state: L.state === 'open' ? (L.peers ? fill(T.linkPeers, { n: L.peers }) : T.linkAlone) : L.state === 'closed' ? T.linkClosed : T.linkWait });
    }
    if (!extChip) return;
    var parts = [];
    if (L) parts.push(fill(T.linkOn, { room: O.link }) + ' · ' + (L.state === 'open' ? (L.peers ? fill(T.linkPeers, { n: L.peers }) + (L.trip != null ? ' · ' + L.trip + ' ms' : '') : T.linkAlone) : L.state === 'closed' ? T.linkClosed : T.linkWait));
    if (following()) parts.push(fill(T.clockChip, { bpm: Math.round(clk.bpm * 10) / 10 }));
    var txt = parts.join('   ');
    if (txt === extText) return;
    extText = txt; extChip.textContent = txt; extChip.title = txt; extChip.style.display = txt ? '' : 'none';
  }

  // ---- a link: pages in one room hear each other's programs (link=<room>; @openav/relay's MidiLink over the phone relay).
  // What this page's programs play into the virtual output (Strudel's .midi(), clock and all) goes to every other page in
  // the room, with its time; what comes from them is told here when it sounds there (see packages/relay/link.js for how two
  // computers' clocks are lined up). It is never sent on again — and a program that plays back out what it heard from the
  // link (midikeys → .midi on the other page) is caught as an echo within 600 ms and not sent back.
  var link = null, linkState = null, linkEcho = {}, linkEchoN = 0;
  function startLink() {
    if (!O.link || link) return;
    link = { send: function () {} };                     // placeholder until the module is in
    load('packages/relay/link.js').then(function (m) {
      link = new m.MidiLink({ url: O.relay, room: O.link, delay: O.linkdelay,
        onStatus: function (s) { linkState = s; paintExt(); },
        onMessages: function (list) {
          for (var i = 0; i < list.length; i++) {
            var x = list[i], s = x.bytes[0];
            if (s >= 0xF8 || s === 0xF2) clockIn(x.bytes, x.at, 'link'); else later(x.bytes, x.at, 'link');
          }
        } });
      link.connect();
      sayInfo('[oav-p5] link: ' + (zh ? '房間 ' : 'room ') + O.link + (zh ? '（同房間的 oav-p5 頁面互相聽得到虛擬埠送出的 MIDI）' : ' (oav-p5 pages in this room hear what each other\'s programs play)'));
    }, function () { link = null; hint('modfail:link', 'moduleFail', { name: '@openav/relay link', host: hostOf(BASE) }, 'error'); });
  }
  function sig(b) { return (b[0] | 0) + ',' + (b[1] | 0) + ',' + (b[2] | 0); }
  function linkHeard(bytes) { if (++linkEchoN > 512) { linkEcho = {}; linkEchoN = 0; } linkEcho[sig(bytes)] = nowMs(); }
  function linkOut(msg, t) {
    if (!(msg[0] >= 0xF8 || msg[0] === 0xF2)) {
      var k = sig(msg), at = linkEcho[k];
      if (at != null && nowMs() - at < 600) { ext.echoes++; return; }   // what the link just played, played back: not again
    }
    if (link && link.send) link.send(msg, t);
  }
  midi.link = {
    /** { room, state: 'connecting' | 'open' | 'closed', peers (other pages heard in 6 s), rtt, trip, diff, lead, late, sent, received } */
    get info() { return linkState || (O.link ? { room: O.link, state: link ? 'connecting' : 'off', peers: 0 } : null); },
    _link: function () { return link; },
  };

  // ---------------------------------------------------------------- the microphone: micLevel · bass · mid · treble · beat
  // Off until a sketch asks: it reads one of the names below, calls startMic(), or someone presses 🎤 in the 🎹 panel.
  // The analysis is @openav/audio's AudioAnalyzer (loaded from next to this file, the first time) with its own
  // AudioContext, so p5.sound can run beside it. Browsers want a click before audio plays: a read from draw() asks
  // for the microphone at once, and the first click or key afterwards starts it if the browser held it back.
  var micCbs = { beat: 'beatDetected', kick: 'kickDetected', snare: 'snareDetected', hat: 'hatDetected' };
  var micSubs = { beat: [], kick: [], snare: [], hat: [] };
  var mic = {
    state: 'off',                                   // off · asking · on · denied · unavailable
    sensitivity: 1,                                 // 2 = everything twice as loud (+6 dB on micLevel, ×2 on the bands): micSensitivity(2)
    get gain() { return mic.sensitivity; }, set gain(v) { mic.sensitivity = +v > 0 ? +v : 1; },   // (0.3.0's name)
    level: 0, bass: 0, mid: 0, treble: 0, error: null, analyzer: null,
    rms: 0, db: -100, floor: -60,                   // the raw loudness (smoothed RMS 0..1), it in dBFS, and the room's own noise in dBFS
    start: function () { micStopped = false; return startMic(); }, stop: function () { return stopMic(); },
    /** mic.on('beat' | 'kick' | 'snare' | 'hat', fn(level)) → off() */
    on: function (name, fn) {
      if (!micSubs[name]) throw new Error('[oav-p5] unknown mic event "' + name + '" (' + Object.keys(micSubs).join(', ') + ')');
      micSubs[name].push(fn);
      return function () { var i = micSubs[name].indexOf(fn); if (i >= 0) micSubs[name].splice(i, 1); };
    },
    _frame: function (f, now) { return micFrame(f, now); },   // for tests: one analyser frame in (at `now` ms)
  };
  midi.mic = mic;
  var micStarting = null, micAudio = null, micStopped = false, micTries = 0, micRead = false, micLoop = false;
  var micSeq = 0, micSeen = 0, micTick = 0, micFrameAt = null, micFrameBeat = false;
  function clamp01(x) { return x < 0 ? 0 : x > 1 ? 1 : x; }
  function setMic(s) {
    if (mic.state === s) return;
    mic.state = s; put('micIsOn', s === 'on'); paintMic();
    if (s !== 'asking') unhint('micAsking');
    if (s === 'on') ['micDenied', 'micSystem', 'micFrame', 'micMissing', 'micBusy'].forEach(unhint);
    if (s === 'on') sayInfo('[oav-p5] microphone on: ' + T.micHint + ' · beatDetected(level), kickDetected, snareDetected, hatDetected');
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
      hint(g.isSecureContext === false || (g.location && g.location.protocol === 'http:' && !/^(localhost|127\.0\.0\.1|\[::1\])$/.test(g.location.hostname)) ? 'micInsecure' : 'micMissing');
      return Promise.resolve(false);
    }
    micTries++; setMic('asking');
    setTimeout(function () { if (mic.state === 'asking') hint('micAsking', null, null, 'info'); }, 3500);
    var p = micStarting = load('packages/audio/index.js').then(function (m) {
      var a = new m.AudioAnalyzer({ fftSize: 2048 });
      return a.enableMic().then(function () { micAudio = a; mic.analyzer = a; mic.error = null; micStopped = false; setMic('on'); runMic(); return true; });
    }).then(null, function (e) {
      mic.error = (e && (e.name || e.message)) || String(e);
      setMic(e && (e.name === 'NotAllowedError' || e.name === 'SecurityError') ? 'denied' : 'unavailable');
      micTrouble(e);
      return false;
    });
    p.then(function () { if (micStarting === p) micStarting = null; });
    return p;
  }
  // why the microphone did not come: the browser's error name says which of five things to tell the student
  function micTrouble(e) {
    var n = (e && e.name) || '', m = String((e && e.message) || '');
    if (n === 'NotAllowedError' || n === 'SecurityError') hint(frameBlocks('microphone') ? 'micFrame' : /system/i.test(m) ? 'micSystem' : 'micDenied');
    else if (n === 'NotFoundError' || n === 'OverconstrainedError' || n === 'NotSupportedError') hint('micMissing');
    else if (n === 'NotReadableError' || n === 'AbortError') hint('micBusy');
    else sayInfo('[oav-p5] ' + (zh ? '麥克風沒開成（' : 'no microphone (') + (n || m) + (zh ? '）' : ')'));
  }
  /** this page is in an iframe whose permissions policy leaves `feature` out (an embed without allow="microphone") */
  function frameBlocks(feature) {
    try { if (g.self === g.top) return false; } catch (x) { /* a cross-origin top: framed */ }
    try { var p = doc && (doc.permissionsPolicy || doc.featurePolicy); if (p && typeof p.allowsFeature === 'function') return !p.allowsFeature(feature); } catch (x) { /* */ }
    return false;
  }
  function stopMic() {
    micStopped = true;
    try { var s = micAudio && micAudio.source && micAudio.source.mediaStream; if (s) s.getTracks().forEach(function (t) { t.stop(); }); } catch (e) { /* */ }
    try { if (micAudio && micAudio.ctx && micAudio.ctx.close) micAudio.ctx.close(); } catch (e) { /* */ }
    micAudio = null; mic.analyzer = null; micStarting = null;
    mic.level = mic.bass = mic.mid = mic.treble = mic.rms = 0; mic.db = -100;
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
    if (TS_OF[kind]) put(TS_OF[kind], hitTs());
    if (hitSeq[kind] != null) hitSeq[kind]++;
    var name = micCbs[kind], fn = g[name];
    if (typeof fn === 'function') { try { fn.call(g, level); } catch (e) { report(name, e); } }
    var list = micSubs[kind].slice();
    for (var i = 0; i < list.length; i++) { try { list[i].call(g, level); } catch (e) { report(name, e); } }
  }
  // micLevel is how loud it SOUNDS, 0..1: decibels, because the ear (and a circle that should grow when someone talks) hears
  // ratios, and a talking voice is an RMS of only 0.01–0.05. The bottom of the scale is the room itself: the floor follows the
  // quietest recent readings (down within a second, up at most 1.5 dB a second, -70..-45 dB), and 6 dB above it reads 0, so a
  // humming classroom still rests near 0; -10 dBFS (shouting into a laptop) reads 1. So talking ≈ 0.4–0.6, a quiet voice ≈ 0.3.
  var MIC_TOP = -10, micAt = null;
  function micLoudness(rms, now) {
    var db = rms > 1e-5 ? 20 * Math.log10(rms) : -100;
    var dt = micAt == null ? 0 : Math.max(0, Math.min(0.25, (now - micAt) / 1000));
    micAt = now;
    if (db < mic.floor) mic.floor += (db - mic.floor) * (1 - Math.exp(-dt / 0.4));
    else mic.floor += Math.min(db - mic.floor, 1.5 * dt);
    mic.floor = Math.max(-70, Math.min(-45, mic.floor));
    var lo = Math.min(mic.floor + 6, MIC_TOP - 18), boost = 20 * Math.log10(mic.sensitivity);
    mic.rms = rms; mic.db = db;
    return clamp01((db + boost - lo) / (MIC_TOP - lo));
  }
  function micFrame(f, now) {
    var k = mic.sensitivity;
    mic.level = micLoudness(f.rms, now == null ? clock() : now);
    mic.bass = clamp01(f.low * k); mic.mid = clamp01(f.mid * k); mic.treble = clamp01(f.high * k);
    micTick++;
    // while the drum machine plays, the hits are its own: what the microphone hears then is mostly the drums coming out of
    // the speakers, so the same snareDetected came twice, a kick heard as a snare (2026-10-20 哲宇：「snare detected 也會在
    // 大鼓的時候觸發耶」). micLevel, bass, mid and treble still follow the microphone.
    if (drums.state !== 'on') {
      if (f.onset) { micSeq++; micCall('beat', mic.level); }
      if (f.kick && f.kick.hit) micCall('kick', clamp01(f.kick.level * k));
      if (f.snare && f.snare.hit) micCall('snare', clamp01(f.snare.level * k));
      if (f.hat && f.hat.hit) micCall('hat', clamp01(f.hat.level * k));
    }
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
    if (name in g) { yielded.push(name); return; }
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
  // kickIsDetected · snareIsDetected · hatIsDetected (0.8.2, 2026-10-20 哲宇：「類似 mouseIsPressed 那種瞬間訊號……這樣直接
  // lag 就可以做成持續變數拿來控制透明度」): true in the one p5 frame after a hit, the drum machine's (or the microphone's when
  // no drums play), the same answer however often that frame reads it, like `beat`; lag(kickIsDetected, 0, 0.3) fades it out.
  // Reading one does not ask for the microphone by itself: with no drums it counts as wanting the microphone's hits, the way
  // defining kickDetected() does (the first click opens it).
  var hitSeq = { kick: 0, snare: 0, hat: 0 }, hitSeen = { kick: 0, snare: 0, hat: 0 }, hitNow = { kick: false, snare: false, hat: false };
  var hitAt = { kick: null, snare: null, hat: null }, hitRead = false;
  function hitIs(kind) {
    hitRead = true;
    var at = typeof g.frameCount === 'number' ? g.frameCount : micTick;
    if (at !== hitAt[kind]) { hitAt[kind] = at; hitNow[kind] = hitSeq[kind] !== hitSeen[kind]; hitSeen[kind] = hitSeq[kind]; }
    return hitNow[kind];
  }
  function hitName(name, kind) {
    if (name in g) { yielded.push(name); return; }
    try {
      Object.defineProperty(g, name, {
        configurable: true, enumerable: false,
        get: function () { return hitIs(kind); },
        set: function (v) { Object.defineProperty(g, name, { value: v, writable: true, configurable: true, enumerable: true }); },
      });
    } catch (e) { /* */ }
  }
  hitName('kickIsDetected', 'kick'); hitName('snareIsDetected', 'snare'); hitName('hatIsDetected', 'hat');
  FUNCS.startMic = function () { return mic.start(); };
  /** micSensitivity(2): twice as sensitive (a quiet microphone, a far-away voice); micSensitivity() says what it is */
  FUNCS.micSensitivity = function (v) { if (v != null && +v > 0) mic.sensitivity = Math.max(0.05, Math.min(20, +v)); return mic.sensitivity; };
  FUNCS.stopMic = function () { return mic.stop(); };
  // first click or key: resume audio a browser held back; start a microphone the sketch asked for but the browser refused
  // without a gesture; start one for a sketch that defines beatDetected() & co. but reads nothing
  function micGesture() {
    if (O.mic === 'off' || micStopped) return;
    if (mic.state === 'on') { try { if (micAudio.ctx.state === 'suspended') micAudio.ctx.resume(); } catch (e) { /* */ } return; }
    // (a sketch that started the drum machine defines kickDetected() & co. for the drums: that alone does not open the microphone)
    var wants = micRead || (O.mic === 'auto' && !drumsWanted && (hitRead || Object.keys(micCbs).some(function (kd) { return typeof g[micCbs[kd]] === 'function'; })));
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

  // ---------------------------------------------------------------- hints: what happened, why, and what to press — on the page
  // A student looks at the canvas, not at OpenProcessing's console under it: a blocked microphone there just looks like a
  // broken sketch. So each situation becomes one small card beside the 🎹 (never over the middle of the canvas), in the
  // page's language, once per page, with a ×; the console gets the same sentence. hints=off keeps them in the console only.
  var HINTS_ON = opt('hints', 'on') !== 'off';
  var H = zh ? {
    micDenied: ['麥克風被擋下了', '這個網頁沒拿到麥克風權限，所以 micLevel、bass 一直是 0。', '點網址列左邊的鎖頭（或 ⓘ）→ 麥克風選「允許」→ 回來點一下畫面。'],
    micSystem: ['電腦的系統設定擋住了麥克風', '瀏覽器自己沒有用麥克風的權限，所以 micLevel 一直是 0。', 'Mac：系統設定 → 隱私權與安全性 → 麥克風 → 打開你的瀏覽器，重開瀏覽器再點一下畫面。'],
    micFrame: ['麥克風在這個嵌入框裡被擋住了', '這份草圖被嵌在別的網頁裡（iframe），外層網頁沒有允許麥克風。', '打開草圖自己的頁面再試（OpenProcessing：作品頁或全螢幕）；放網站的人在 <iframe> 加上 allow="microphone"。'],
    micInsecure: ['這頁拿不到麥克風', '網址不是 https（也不是 localhost），瀏覽器不讓網頁用麥克風。', '改用 https:// 開頭的網址打開。'],
    micMissing: ['找不到麥克風', '這台電腦沒有能用的麥克風（沒接上，或系統關掉了）。', '接上耳機麥克風，再按 🎹 → 🎤。'],
    micBusy: ['麥克風被別的程式占用', 'Zoom、OBS、Discord 這類程式正在用它。', '關掉那個程式，再按 🎹 → 🎤。'],
    micAsking: ['瀏覽器在問你要不要給麥克風', '按「允許」之前，micLevel 都是 0。', '看網址列下面跳出的小視窗，按「允許」。'],
    midiNone: ['這個瀏覽器沒有 Web MIDI', 'Safari 和 iPad 接不到實體 MIDI 鍵盤。', '按 🎹 用螢幕上的鍵盤，或 📱 用手機彈；要接實體鍵盤請改用 Chrome 或 Edge。'],
    midiDenied: ['MIDI 權限被擋下了', '實體鍵盤、控制器的訊號進不來。', '點網址列左邊的鎖頭 → MIDI 裝置選「允許」→ 重新整理；或先按 🎹 用螢幕上的鍵盤。'],
    noteBad: ['看不懂這個音名：{v}', '音名用 A–G，加上可選的 # 或 b，再加八度數字（C4 是中央 C，MIDI 60），要落在 C-1 到 G9。', '音名用 A–G＋可選的 # 或 b＋八度數字，像 C4、F#3、Bb2；或直接寫號碼 0–127。'],
    cbError: ['你的 {name}() 出錯了：{msg}', '{where}草圖還在跑，只是這一下沒做完。', '去看{line}；console 裡有完整的錯誤。'],
    strudelNames: ['這頁已經有 {names}（Strudel 的）', 'oav-p5 不動它們：Strudel 的 note()、velocity() 照常能用。旋鈕、麥克風照樣讀 knob1、micLevel。', '控制器和麥克風的這幾個值改讀：{alts}。'],
    ownName: ['你的草圖自己有一個 {name}', '（let、var 或 function 宣告了同名的東西）所以 oav-p5 不寫它：草圖讀到的是你自己的 {name}。', '要讀控制器的值：改用 {alt}，或把你自己的變數改個名字。'],
    knobBoth: ['{ctl}交給你的草圖了', '你的草圖直接讀 {read}，OPC 的拉桿 {opc} 原本也接在{ctl}：一顆旋鈕不同時動兩件事。', '{opc} 改用 OPC 面板的滑桿拉；想用旋鈕控制 {opc}，就在草圖裡用 {opc}、不要讀 {read}。'],
    sndClick: ['聲音準備好了，還沒響', '瀏覽器要網頁被點過一下才讓它出聲（按 MIDI 鍵盤不算）。', '點一下畫面任何地方（或按一個鍵）。'],
    sndLoading: ['{name}載入中（第一次要幾秒）', '載好之前先用{other}頂著，彈下去一樣有聲音。', ''],
    sndFallback: ['{name}載不到，改用{other}', '音色檔沒下載成功（網路？）。', '可以繼續彈；換個網路後按 🎹 → 🔊 再選一次。'],
    sndTone: ['聲音引擎（Tone.js）載不到', '連不上 {host}（網路、學校防火牆或擋廣告的外掛）。', '換個網路後按 🎹 → 🔊 再試；或用選項 tone= 指到別的 Tone.js。'],
    drumsClick: ['鼓機在打，但還沒有聲音', '瀏覽器要網頁被點過一下才讓它出聲；畫面上的反應照樣會動。', '點一下畫面任何地方。'],
    rhythmBad: ['節奏字串第 {n} 個字有問題', '{line}\n{why}', '{fix}鼓機先打 four on floor。'],
    rhythmGrid: ['這是一軌 16 格的寫法，要放進 { }', '"{text}" 用 x 和 . 寫的是一軌，startDrums 要知道是哪一軌。', "寫成 startDrums({ kick: '{text}' })；或用節奏字串，例如 \"bd*4, hh*8\"（休止用 ~）。鼓機先打 four on floor。"],
    rhythmTakeover: ['格子接手了', '你點了格子，鼓機改照格子打：{lost}。', '要回到那一行字：重新執行草圖，或再呼叫 startDrums("{text}")。'],
    rhythmWhy: { unclosed: '「{ch}」打開了沒有關上：[ 配 ]、< 配 >、( 配 )。', 'bad-euclid': '歐幾里得節奏要寫成 (幾下,幾格) 或 (幾下,幾格,轉幾格)：整數，下數不超過格數。',
      'unknown-word': '不認得「{word}」：鼓的名字是 bd 大鼓、sd 小鼓、hh 鈸、oh 開鈸、cp 拍手、rim 鼓邊、lt／mt／ht 中鼓、cr 碎音鈸、rd 疊音鈸、cb 牛鈴；休止用 ~。',
      empty: '這一行沒有任何鼓（空的，或全是休止）。', 'bad-number': '「{word}」這裡的數字不對：要是大於 0 的數。', dot: '「.」在節奏字串裡不是休止。', other: '{msg}' },
    rhythmFix: { unclosed: '在這一組結束的地方補上 {close}，例如 "bd [sd sd]"。', 'bad-euclid': '例如 "bd(3,8)"：8 格裡平均打 3 下。', 'unknown-word': '把「{word}」改成上面其中一個。',
      preset: "節奏名稱要一字不差：startDrums('{preset}')。", empty: '至少寫一個鼓，例如 "bd*4"。', 'bad-number': '例如 "hh*8"、"bd@3"、"hh?0.3"。',
      dot: "休止用 ~ 或 -；一軌 16 格的 'x...' 要放進 { kick: 'x...' }。", other: '{hint}' },
    rhythmLost: { offGrid: '{n} 下不在 16 格上的音移到最近的格子', dropped: '格子沒有{voices}這幾軌，先拿掉', varied: '每小節輪替的部分只留第 {bar} 小節', none: '節奏一樣，之後照格子改', sep: '；' },
    rhythmKeep: ['節奏字串第 {n} 個字有問題', '{line}\n{why}', '{fix}鼓機先照上一個能用的版本打。'],
    rhythmLossy: ['格子寫不出這一行的全部', '這一行有格子表達不了的東西：{lost}。再點一次格子，就換成格子寫得出的寫法。', '換了以後，按鼓機卡上的 ↶（或 ⌘Z／Ctrl+Z）回到原本那一行。'],
    rhythmLossyWhat: { offGrid: '{n} 下不在 16 格上的音（像三連音）', varies: '每小節不一樣的部分（< >、/2，只留第 {bar} 小節）', random: '? 的隨機', samples: 'bd:2 這種樣本編號', stacked: '同一格疊兩下', sep: '、' },
    rhythmBank: ['{call} 先略過', 'OAV 的鼓機用自己合成的鼓組，沒有那組取樣音色；節奏照打。', '想聽那組音色：按鼓機卡上的「在 Strudel 打開」。'],
    rhythmChain: ['{call} 這段 OAV 還不支援', 'OAV 讀 s("…")／sound("…") 裡的節奏和 .fast()、.slow()；其他的先略過，主體照打。', '按鼓機卡上的「在 Strudel 打開」，在那邊玩完整的寫法。'],
    rhythmNoS: ['這段 Strudel 程式裡沒有鼓的節奏', '鼓機只讀 s("…") 或 sound("…") 裡的字串。', '寫成 startDrums(\'s("bd*4, hh*8")\')，或直接 startDrums("bd*4, hh*8")。鼓機先打 four on floor。'],
    moduleFail: ['{name} 載不到', '連不上 {host}。', '檢查網路，重新整理再試。'],
    recStart: ['開始錄影（{len}）', '只錄畫布和作品的聲音（{audio}）；🎹、鼓機格子和這些提示不會進影片。{micNote}', '{stop}'],
    recSaved: ['錄好了：{name}', '{format} · {dur} · {size} · {wh} · {sound}', '{next}'],
    recWebm: ['這段是 WebM：IG 不收', '{browser} 不能直接錄 MP4（新版 Chrome 和 Safari 可以）。', '用新版 Chrome（126 以後）或 Safari 再錄一次；或把檔案轉成 MP4（HandBrake 或線上轉檔）。'],
    recNone: ['這個瀏覽器不能錄影', '{why}。', '改用電腦版 Chrome、Edge 或 Safari；或按 🎹 → 📷 存圖。'],
    recNoCanvas: ['找不到要錄的畫布', '頁面上還沒有 p5 的畫布。', '在 setup() 裡先 createCanvas(…)，再按 ⏺ 或呼叫 startRecording()。'],
    recTainted: ['這個畫布不能錄', '畫布上畫過別的網站的圖片（沒有 CORS），瀏覽器就不讓錄影、也不讓存圖。', '把圖片上傳到 OpenProcessing 的 Files（或放在同一個網站），用 loadImage("檔名") 讀進來。'],
    recBlack: ['錄出來整段是黑的', '畫布上明明有畫面，影片卻全黑：iPhone／Safari 錄 WebGL 畫布有這個已知問題（WebKit 229611）。', '改用電腦版 Chrome 再錄；一定要在手機錄，就先試 2D 畫布（createCanvas 不加 WEBGL）。'],
    recSilent: ['影片裡沒有聲音', '錄的時候{src}開著，但從頭到尾沒有聲音進到錄影裡。', '先點一下畫面、確定聽得到聲音（彈幾個音或開鼓機），再按 ⏺ 錄一次。'],
    recNoAudio: ['影片沒有音軌', '這個瀏覽器沒辦法把網頁的聲音接進錄影（{why}）。', '改用電腦版 Chrome 或 Safari 再錄。'],
    recEmpty: ['錄到的檔案幾乎是空的', '只有 {size}：瀏覽器的錄影器沒有吐出畫面。', '重新整理再錄一次；還是一樣就換電腦版 Chrome。'],
    recLimit: ['錄到 {m} 分鐘上限，自動停了', '太長的影片會吃光記憶體，所以一段最多 {m} 分鐘；錄到的已經存好。', '要更長就分段錄，或用選項 reclimit=（秒數）放寬。'],
    recError: ['錄影中斷了：{msg}', '瀏覽器的錄影器出錯；已經錄到的部分照樣會存下來。', '再按一次 ⏺；一直這樣就換電腦版 Chrome。'],
    recP5sound: ['p5.sound 的聲音不會進影片', '這頁的 p5.sound 是給 p5 2.x 的版本：它的每個聲音直接接到喇叭，沒有總輸出可以接進錄影。', '要錄它的聲音：OpenProcessing 把 p5.js 版本切到 1.11；或改用 startSound()、startDrums()。'],
    shotSaved: ['存好了：{name}', '{wh} 的 PNG，只有畫布（不含 🎹 和提示）。', '{next}'],
    rec: { secs: '錄 {n} 秒', max: '最長 {m} 分鐘', stopSecs: '{n} 秒後自動停，錄完自動下載。', stopBtn: '按 ⏹（或 🎹 旁的紅點）停止，錄完自動下載。', stopPhone: '按 ⏹（或 🎹 旁的紅點）停止，錄完按「分享」存影片。',
      micNote: '麥克風也會收：戴耳機才不會把喇叭的聲音又錄一次（不要麥克風：選項 record=nomic）。', none: '還沒有聲音在播；開了 🔊、🥁、🎤 會自動加進來',
      src: { sound: '🔊 聲音', drums: '🥁 鼓機', mic: '🎤 麥克風', p5sound: 'p5.sound' }, sep: '、', sec: ' 秒', heard: '有聲音', silent: '無聲', noTrack: '沒有音軌',
      saved: '已經存到「下載」；IG、YouTube 都能直接上傳。', savedWebm: '已經存到「下載」（WebM：IG 不收，看下一則）。', phone: '按「分享」→ 儲存影片，或直接傳到 IG。', shotSaved: '在「下載」資料夾。', shotPhone: '按「分享」→ 儲存影像。',
      whyRecorder: '它沒有錄影的功能（MediaRecorder）', whyCapture: '它不能擷取畫布（captureStream）', whyAudio: '沒有 Web Audio', browser: '這個瀏覽器' },
    close: '關掉這則提示', line: '第 {n} 行', at: '在 {file} 第 {n} 行。',
  } : {
    micDenied: ['The microphone is blocked', 'This page has no permission to use it, so micLevel and bass stay at 0.', 'Click the lock (or ⓘ) left of the address → Microphone: Allow → click the canvas once.'],
    micSystem: ["Your computer's settings block the microphone", 'The browser itself may not use it, so micLevel stays at 0.', 'Mac: System Settings → Privacy & Security → Microphone → turn on your browser, restart it, click the canvas.'],
    micFrame: ['The microphone is blocked inside this embed', 'This sketch sits in another page (an iframe) that does not allow the microphone.', "Open the sketch's own page (OpenProcessing: the sketch page or full screen); whoever embeds it adds allow=\"microphone\" to the <iframe>."],
    micInsecure: ['No microphone on this page', 'The address is not https (nor localhost): browsers keep the microphone from such pages.', 'Open it from an https:// address.'],
    micMissing: ['No microphone found', 'This computer has no microphone it can use (none plugged in, or turned off in the system).', 'Plug in a headset, then 🎹 → 🎤.'],
    micBusy: ['Another app holds the microphone', 'Zoom, OBS, Discord or the like is using it.', 'Quit that app, then 🎹 → 🎤.'],
    micAsking: ['The browser is asking for the microphone', 'Until you allow it, micLevel is 0.', 'Look for the small box under the address bar and press Allow.'],
    midiNone: ['No Web MIDI in this browser', 'Safari and iPad cannot reach a MIDI keyboard.', 'Press 🎹 for the keyboard on screen, or 📱 to play from a phone; for a real keyboard use Chrome or Edge.'],
    midiDenied: ['MIDI permission is blocked', 'Keyboards and controllers cannot reach the page.', 'Click the lock left of the address → MIDI devices: Allow → reload; or press 🎹 for the keyboard on screen.'],
    noteBad: ['Not a note name: {v}', 'A note name is a letter A–G, an optional # or b, and an octave number (C4 is middle C, MIDI 60), from C-1 to G9.', 'Write a letter A–G + an optional # or b + an octave number, like C4, F#3, Bb2; or a number 0–127.'],
    cbError: ['Your {name}() threw an error: {msg}', '{where}The sketch keeps running; only this call did not finish.', 'Look at {line}; the console has the whole error.'],
    strudelNames: ["This page already has {names} (Strudel's)", "oav-p5 leaves them alone: Strudel's note() and velocity() work as before. Knobs and the microphone still read as knob1, micLevel.", 'For these values of the controller and the microphone, read: {alts}.'],
    ownName: ['Your sketch has its own {name}', '(a let, var or function of that name), so oav-p5 leaves it alone: the sketch reads its own {name}.', 'For the controller, read {alt} instead, or rename your variable.'],
    knobBoth: ['{ctl} is now the sketch\'s', 'Your sketch reads {read}, and OPC\'s slider {opc} was wired to {ctl} too: one knob does not move two things.', 'Drag {opc} on the OPC panel; to turn {opc} with the knob, use {opc} in the sketch instead of {read}.'],
    sndClick: ['Sound is ready but silent', 'Browsers let a page play audio only after a click (a MIDI key does not count).', 'Click anywhere on the canvas (or press a key).'],
    sndLoading: ['Loading {name} (a few seconds the first time)', '{other} plays meanwhile, so every key is heard.', ''],
    sndFallback: ['{name} did not load: playing {other}', 'Its sound files did not download (the network?).', 'Keep playing; on another network pick it again in 🎹 → 🔊.'],
    sndTone: ['The sound engine (Tone.js) did not load', 'No connection to {host} (network, a school firewall or an ad blocker).', 'On another network try 🎹 → 🔊 again, or point the tone= option at another copy of Tone.js.'],
    drumsClick: ['The drum machine plays, silently', 'Browsers let a page play audio only after a click; the visuals react anyway.', 'Click anywhere on the canvas.'],
    rhythmBad: ['The rhythm has a problem at character {n}', '{line}\n{why}', "{fix}The machine plays 'four on floor' meanwhile."],
    rhythmGrid: ['That is one lane of 16 steps: put it inside { }', '"{text}" (x and .) is one lane, and startDrums needs to know which.', "Write startDrums({ kick: '{text}' }); or a rhythm string such as \"bd*4, hh*8\" (~ is a rest). 'four on floor' plays meanwhile."],
    rhythmTakeover: ['The cells took over', 'You clicked a cell, so the machine now plays the grid: {lost}.', 'To get the line back: run the sketch again, or call startDrums("{text}") again.'],
    rhythmWhy: { unclosed: '"{ch}" is opened and never closed: [ with ], < with >, ( with ).', 'bad-euclid': 'A Euclidean rhythm is (hits,steps) or (hits,steps,rotation): whole numbers, no more hits than steps.',
      'unknown-word': 'No drum called "{word}": bd kick, sd snare, hh hat, oh open hat, cp clap, rim, lt / mt / ht toms, cr crash, rd ride, cb cowbell; ~ is a rest.',
      empty: 'There is no drum in this line (it is empty, or all rests).', 'bad-number': 'The number at "{word}" is not right: it has to be above 0.', dot: '"." is not a rest in a rhythm string.', other: '{msg}' },
    rhythmFix: { unclosed: 'Close it with {close} where the group ends, e.g. "bd [sd sd]". ', 'bad-euclid': 'E.g. "bd(3,8)": 3 hits spread over 8 steps. ', 'unknown-word': 'Change "{word}" to one of these. ',
      preset: "Rhythm names are spelled exactly: startDrums('{preset}'). ", empty: 'Write at least one drum, e.g. "bd*4". ', 'bad-number': 'E.g. "hh*8", "bd@3", "hh?0.3". ',
      dot: "A rest is ~ or -; one lane of 16 steps, 'x...', goes inside { kick: 'x...' }. ", other: '{hint} ' },
    rhythmLost: { offGrid: '{n} hit(s) off the 16 steps moved to the nearest one', dropped: 'the grid has no lane for {voices}, so they are out', varied: 'what changed from bar to bar keeps bar {bar} only', none: 'the same rhythm, now on the cells', sep: '; ' },
    rhythmKeep: ['The rhythm has a problem at character {n}', '{line}\n{why}', '{fix}The machine keeps playing the last line that worked.'],
    rhythmLossy: ['The cells cannot hold all of this line', 'It has what 16 steps cannot write: {lost}. Click a cell again to rewrite it the way the grid can.', 'Afterwards ↶ on the drum card (or ⌘Z / Ctrl+Z) brings the original line back.'],
    rhythmLossyWhat: { offGrid: '{n} hit(s) between the steps (a triplet)', varies: 'what changes from bar to bar (< >, /2: bar {bar} stays)', random: 'the chance of ?', samples: 'sample numbers like bd:2', stacked: 'two hits in one step', sep: ', ' },
    rhythmBank: ['{call} is left out', "OAV's drum machine plays its own synthesized kit, not that sample bank; the rhythm plays.", 'To hear that bank: "Open in Strudel" on the drum card.'],
    rhythmChain: ['OAV does not do {call} yet', 'It reads the rhythm in s("…") / sound("…") with .fast() and .slow(); the rest is left out and the main line plays.', 'Press "Open in Strudel" on the drum card and play the whole thing there.'],
    rhythmNoS: ['No drum rhythm in this Strudel code', 'The machine reads the text inside s("…") or sound("…").', 'Write startDrums(\'s("bd*4, hh*8")\'), or just startDrums("bd*4, hh*8"). \'four on floor\' plays meanwhile.'],
    moduleFail: ['{name} did not load', 'No connection to {host}.', 'Check the network and reload.'],
    recStart: ['Recording ({len})', "The canvas and the sketch's sound only ({audio}); the 🎹, the drum grid and these cards stay out of the video. {micNote}", '{stop}'],
    recSaved: ['Saved: {name}', '{format} · {dur} · {size} · {wh} · {sound}', '{next}'],
    recWebm: ['This one is WebM: Instagram will not take it', '{browser} cannot record MP4 itself (a recent Chrome and Safari can).', 'Record again in Chrome 126 or later, or in Safari; or convert the file to MP4 (HandBrake, an online converter).'],
    recNone: ['This browser cannot record video', '{why}.', 'Use Chrome, Edge or Safari on a computer; or 🎹 → 📷 to save an image.'],
    recNoCanvas: ['No canvas to record', 'There is no p5 canvas on the page yet.', 'Call createCanvas(…) in setup() first, then ⏺ or startRecording().'],
    recTainted: ['This canvas cannot be recorded', 'It has drawn an image from another site (without CORS), and browsers then refuse to record or save it.', 'Upload the image to the sketch\'s Files on OpenProcessing (or the same site) and loadImage("file name") it.'],
    recBlack: ['The recording is black from start to end', 'The canvas shows a picture but the video does not: a known problem when Safari / iPhone records a WebGL canvas (WebKit 229611).', 'Record in Chrome on a computer; on a phone, try a 2D canvas (createCanvas without WEBGL).'],
    recSilent: ['The video has no sound', '{src}: on while recording, yet nothing ever reached the recording.', 'Click the canvas once and make sure you hear it (play a few notes, start the drums), then ⏺ again.'],
    recNoAudio: ['The video has no audio track', 'This browser cannot route the page\'s sound into a recording ({why}).', 'Record in Chrome or Safari on a computer.'],
    recEmpty: ['The file is almost empty', 'Only {size}: the browser\'s recorder produced no picture.', 'Reload and record again; if it stays this way, use Chrome on a computer.'],
    recLimit: ['Stopped at the {m}-minute limit', 'Longer takes would fill the tab\'s memory, so one is {m} minutes at most; what was recorded is saved.', 'Record in parts, or raise it with the option reclimit= (seconds).'],
    recError: ['Recording stopped: {msg}', 'The browser\'s recorder failed; what was recorded so far is still saved.', 'Press ⏺ again; if it keeps happening, use Chrome on a computer.'],
    recP5sound: ['p5.sound will not be in the video', 'This page runs the p5.sound made for p5 2.x: each of its sounds goes straight to the speakers, with no output a recording can tap.', 'To record it: set the p5.js version to 1.11 (OpenProcessing: sketch settings), or use startSound() and startDrums().'],
    shotSaved: ['Saved: {name}', 'A {wh} PNG of the canvas alone (no 🎹, no cards).', '{next}'],
    rec: { secs: '{n} s', max: 'up to {m} min', stopSecs: 'It stops by itself after {n} s and downloads.', stopBtn: 'Press ⏹ (or the red dot beside the 🎹) to stop; it downloads by itself.', stopPhone: 'Press ⏹ (or the red dot beside the 🎹) to stop, then Share to keep the video.',
      micNote: 'The microphone is recorded too: wear headphones, or the speakers are recorded twice (leave it out: the option record=nomic).', none: 'nothing sounds yet; 🔊, 🥁 and 🎤 join the recording when they come on',
      src: { sound: '🔊 sound', drums: '🥁 drums', mic: '🎤 microphone', p5sound: 'p5.sound' }, sep: ', ', sec: ' s', heard: 'with sound', silent: 'silent', noTrack: 'no audio track',
      saved: 'In your Downloads; Instagram and YouTube take it as it is.', savedWebm: 'In your Downloads (WebM: not for Instagram, see the next card).', phone: 'Share → Save Video, or send it straight to Instagram.', shotSaved: 'In your Downloads.', shotPhone: 'Share → Save Image.',
      whyRecorder: 'It has no video recorder (MediaRecorder)', whyCapture: 'It cannot capture a canvas (captureStream)', whyAudio: 'no Web Audio', browser: 'This browser' },
    close: 'Close this hint', line: 'line {n}', at: 'At {file} line {n}. ',
  };
  var hinted = {}, hintList = [], hintBox = null, hintQueue = [];
  midi.hints = hintList;                              // what was said, for OAVp5.check() and tests: [{ id, kind, what, why, next }]
  function fill(t, o) { return String(t || '').replace(/\{(\w+)\}/g, function (m, k) { return o && o[k] != null ? o[k] : ''; }); }
  /** hint('micDenied') or hint(id, 'cbError', { name, msg }) — once per id per page; kind: error · warn · info;
   *  x: { actions: [{ label, fn }] (buttons on the card: Share, Download), ttl: ms until it goes by itself } */
  function hint(id, key, o, kind, x) {
    if (hinted[id]) return null;
    var t = H[key || id];
    if (!t) return null;
    var h = { id: id, kind: kind || 'warn', what: fill(t[0], o), why: fill(t[1], o), next: fill(t[2], o) };
    if (x && x.actions && x.actions.length) h.actions = x.actions;
    if (x && x.ttl && HINTS_ON && doc) setTimeout(function () { if (hinted[id] === h) unhint(id); }, x.ttl);   // a card on screen only
    hinted[id] = h; hintList.push(h);
    if (g.console && !QUIET) (h.kind === 'info' ? console.info : console.warn).call(console, '[oav-p5] ' + h.what + (zh ? '：' : ': ') + h.why + (h.next ? ' → ' + h.next : ''));
    if (HINTS_ON && doc) { if (doc.body) showHint(h); else hintQueue.push(h); }
    return h;
  }
  /** the situation is over (sound came on, the permission arrived): take its card away; it may come back if it happens again */
  function unhint(id) {
    var h = hinted[id];
    if (!h) return;
    delete hinted[id];
    if (h.el && h.el.parentNode) h.el.parentNode.removeChild(h.el);
  }
  function showHint(h) {
    if (!hintBox) {
      hintBox = el('div', 'position:fixed;' + O.corner + ':10px;' + O.dock + ':' + (EDGE + 42) + 'px;z-index:' + (Z + 2) + ';display:flex;flex-direction:' + (O.dock === 'top' ? 'column' : 'column-reverse') +
        ';gap:6px;width:min(340px,calc(100vw - 20px));pointer-events:none');
      hintBox.id = 'oav-p5-hints';
      doc.body.appendChild(hintBox);
      lift();
    }
    var color = { error: '#e06b5f', warn: '#e0c25f', info: '#9fd8ff' }[h.kind];
    var card = el('div', 'pointer-events:auto;position:relative;box-sizing:border-box;padding:8px 30px 9px 11px;border-radius:10px;background:rgba(16,16,20,.94);' +
      'border:1px solid rgba(255,255,255,.18);border-left:4px solid ' + color + ';color:#e8e8ee;font:500 12.5px/1.45 system-ui,sans-serif;box-shadow:0 6px 24px rgba(0,0,0,.35)');
    card.className = 'oav-p5-hint'; card.setAttribute('role', 'status'); card.setAttribute('data-hint', h.id);
    card.appendChild(el('div', 'font-weight:700;color:#fff;margin-bottom:2px;word-break:break-word', h.what));
    if (h.why) card.appendChild(el('div', 'color:#c9cbd4;white-space:pre-line', h.why));
    if (h.next) card.appendChild(el('div', 'color:' + color + ';margin-top:3px', '→ ' + h.next));
    if (h.actions) {
      var row = el('div', 'display:flex;flex-wrap:wrap;gap:6px;margin-top:7px');
      h.actions.forEach(function (a) {
        var b = el('button', 'padding:4px 12px;border-radius:8px;border:1px solid ' + color + ';background:rgba(255,255,255,.06);color:#fff;cursor:pointer;font:600 12.5px system-ui,sans-serif', a.label);
        b.type = 'button';
        b.addEventListener('click', function () { try { a.fn(); } catch (e) { report('a hint button', e); } });
        row.appendChild(b);
      });
      card.appendChild(row);
    }
    var x = el('button', 'position:absolute;top:4px;right:5px;width:22px;height:22px;padding:0;border:0;border-radius:6px;background:none;color:#aaa;cursor:pointer;font:600 15px/1 system-ui,sans-serif', '×');
    x.type = 'button'; x.title = H.close; x.setAttribute('aria-label', H.close);
    x.addEventListener('click', function () { if (card.parentNode) card.parentNode.removeChild(card); });
    card.appendChild(x);
    fence(card);
    h.el = card;
    hintBox.appendChild(card);
    var cards = hintBox.querySelectorAll('.oav-p5-hint');
    if (cards.length > 3) hintBox.removeChild(cards[0]);   // three at a time; the oldest goes
  }
  function flushHints() { var q = hintQueue; hintQueue = []; for (var i = 0; i < q.length; i++) if (hinted[q[i].id] === q[i]) showHint(q[i]); }
  // the file and line of the sketch's own code in an error (the first frame that is not this file)
  function whereIn(e) {
    var lines = String((e && e.stack) || '').split('\n');
    for (var i = 0; i < lines.length; i++) {
      var m = /((?:https?|blob|file):[^\s()]*?)(?::(\d+))(?::(\d+))\)?\s*$/.exec(lines[i]);
      if (!m || /oav-p5\.js/.test(m[1])) continue;
      var file = m[1].split('?')[0].split('#')[0]; file = file.slice(file.lastIndexOf('/') + 1) || file;
      return { file: file, line: +m[2] };
    }
    return null;
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
    unhint('drumsClick');
    var w = audioWaiters; audioWaiters = [];
    for (var i = 0; i < w.length; i++) { try { w[i](); } catch (e) { report('audio', e); } }
    try { if (toneMod && sndWanted) toneMod.start(); } catch (e) { /* */ }
    try { var c = kit && kit.context; if (c && c.state === 'suspended') c.resume(); } catch (e) { /* */ }
    try { var r = recS && recS.mix && recS.mix.ctx; if (r && r.state === 'suspended') r.resume(); } catch (e) { /* */ }   // a recording started before any click
  }
  if (g.addEventListener) ['pointerdown', 'keydown', 'touchend'].forEach(function (t) { g.addEventListener(t, audioGesture, { capture: true, passive: true }); });

  // ---------------------------------------------------------------- sound: what is played is heard (@openav/sound)
  // Off, and nothing loaded, until the sketch calls startSound() or someone presses 🔊 in the 🎹 panel (or the page says
  // ?oav_sound=piano). Then every note — a keyboard, the 🎹 on screen, a phone, midi.play() — goes through @openav/sound's
  // Sound shell to its toneEngine (Tone.js 15 from jsDelivr), the road a show's notes take. Notes on channel 10 (pads:
  // MiniLab 3, LPD8, the General MIDI drum channel) play @openav/drums' kit instead: a pad is a drum, never a piano note.
  var sndBus = bus(), sndOn = false, sndWanted = false, sndTarget = null, sndShellP = null, toneMod = null, sndPct = null;
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
    if (s === 'waiting') hint('sndClick', null, null, 'info'); else unhint('sndClick');
  }
  function instName(id) { try { return snd.module.instrumentName(snd.module.getInstrument(id), zh ? 'zh' : 'en') || id; } catch (e) { return id; } }
  function hostOf(u) { try { return new URL(u, BASE).host; } catch (e) { return u; } }
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
        sndPct = ev.type === 'loading' ? Math.round((ev.progress || 0) * 100) : null;
        // a sampler loading while another instrument plays (the piano over the electric piano): say so, once
        if (ev.type === 'loading' && !ev.progress && snd.instrument && snd.instrument !== ev.id) hint('sndLoading:' + ev.id, 'sndLoading', { name: instName(ev.id), other: instName(snd.instrument) }, 'info');
        if (ev.type === 'instrument') { snd.instrument = ev.id; }
        if (ev.type === 'ready' || ev.type === 'error') unhint('sndLoading:' + ev.id);
        if (ev.type === 'error') hint('sndFail:' + ev.id, ev.fallback ? 'sndFallback' : 'moduleFail', { name: instName(ev.id), other: instName(ev.fallback), host: hostOf(BASE) });
        paintSound();
      });
      snd.shell = shell; snd.engine = engine; snd.instrument = engine.instrument;
      return shell;
    }).then(null, function (e) {
      sndShellP = null; snd.error = (e && e.message) || String(e); setSound('error');
      hint('modfail:sound', 'moduleFail', { name: '@openav/sound', host: hostOf(BASE) }, 'error');
      return null;
    });
    return sndShellP;
  }
  function chooseInstrument(m, shell, id) {
    if (!m.getInstrument(id)) {
      sayInfo('[oav-p5] no instrument "' + id + '": ' + m.listInstruments().map(function (d) { return d.id; }).join(', '));
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
      sayInfo('[oav-p5] sound on (' + sndTarget + '): every key, pad, the 🎹 and a phone are heard');
      return true;
    }, function (e) {
      snd.error = (e && e.message) || String(e); setSound('error');
      hint('sndTone', null, { host: hostOf(O.tone || (snd.module && snd.module.TONE_CDN) || 'https://cdn.jsdelivr.net/') }, 'error');
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
  //
  // Since 0.6 the hits are handed to the kit ahead of time on its audio clock (@openav/drums' DrumTransport: a Web Worker
  // heartbeat every 25 ms, 0.1 s ahead), so a sketch that draws slowly no longer drags the beat, and a hidden tab keeps
  // playing. The callbacks still come in a frame: the one in which each hit is HEARD (its time plus the output latency the
  // browser reports), right before p5's draw() where p5 lets us in, in the same order as before (cue → barStarted →
  // stepStarted → the hits). While the tab is hidden nobody sees a frame: the clock keeps moving (drumStep, drumBar, cues,
  // one barStarted per bar) but no hit or stepStarted is told, and nothing is told twice when the tab comes back.
  // ?oav_drums=frame is 0.5's machine, moved by the frames (the safety net for a class).
  var DRUM_CB = { kick: 'kickDetected', snare: 'snareDetected', clap: 'snareDetected', rim: 'snareDetected', hat: 'hatDetected', openhat: 'hatDetected', pedalhat: 'hatDetected' };
  var DRUM_BEAT = { kick: 1, snare: 1, clap: 1, rim: 1 };   // what a microphone would call a beat: the kick and the snare family
  var drumSubs = { hit: [], step: [], bar: [], cue: [], rhythm: [] };
  var drumBus = bus(), drumsMod = null, drumsModP = null, kit = null, kitStarted = false, machineP = null, drumsWanted = false;
  var drumBeatAt = -1, drumLoop = false, drumCard = null, drumBtn = null, drumReq = 0, patternModP = null, rhythms = {}, preDraw = '';
  var cues = [];
  var drums = {
    state: 'off',                                   // off · loading · on · stopped (grid up, not playing) · error
    step: 0, bar: 0, count: -1, bpm: 112, pattern: 'four on floor', lastCue: '', cues: cues, machine: null,
    start: function (pattern, bpm) { return startDrums(pattern, bpm); }, stop: function () { return stopDrums(); },
    cue: function (bar, name, every) { return addCue(bar, name, every); },
    /** drums.on('hit' | 'step' | 'bar' | 'cue' | 'rhythm', fn) → off(): what the callbacks hear, for Hydra and libraries */
    on: function (name, fn) {
      if (!drumSubs[name]) throw new Error('[oav-p5] unknown drums event "' + name + '" (' + Object.keys(drumSubs).join(', ') + ')');
      drumSubs[name].push(fn);
      return function () { var i = drumSubs[name].indexOf(fn); if (i >= 0) drumSubs[name].splice(i, 1); };
    },
    /** drumPhase / beatPhase: 0..1 through the bar / the beat, as heard */
    get phase() { return drumPhaseNow().bar; }, get beatPhase() { return drumPhaseNow().beat; },
    /** { bar, step, phase, beatPhase, tokens: [{ start, end }] lit in the score line, mode: 'grid' | 'string', text } */
    get now() { var m = drums.machine; return m && m.now ? m.now() : { bar: drums.bar, step: drums.step, phase: 0, beatPhase: 0, tokens: [], mode: 'grid', text: '' }; },
    /** which clock moves the machine: { clock: 'lookahead' | 'frame', heartbeat: 'worker' | 'interval', lookahead, late, latency, … } */
    get clock() { var m = drums.machine; var i = m && m.info ? m.info() : { clock: O.drums, heartbeat: 'none' }; i.preDraw = preDraw; return i; },
    _step: function (i, n, ev) { drumStepped(i, n, ev); }, _hit: function (lane, v) { drumHitIn(lane, v); },   // for tests
    _resolve: function (p) { return resolvePattern(p); },
    _rhythm: function (src, info) { rhythmChangedIn(src, info); }, _lossy: function (info) { lossyHint(info); }, _edit: function (err, text) { editHint(err, text); },
    // ---- 0.7: the line and the cells edit each other
    /** the line that plays now ('bd*4, [~ sd]*2, hh*8'; a preset's grid as its line; '' before the drums and @openav/pattern load) */
    get src() { var m = drums.machine; return m && m.src ? m.src() : ''; },
    /** the line as a strudel.cc link (open it in a new tab); '' when there is none */
    get strudelUrl() { var m = drums.machine; return m && m.strudelUrl ? m.strudelUrl() : ''; },
    /** earlier lines, oldest first: every click on a cell, line typed, or menu pick leaves the one before here */
    get history() { var m = drums.machine; return m && m.history ? m.history : []; },
    /** back one line (↶ on the card, ⌘Z / Ctrl+Z after touching the card) → true if there was one */
    undo: function () { var m = drums.machine; return !!(m && m.undo && m.undo()); },
    /** play a line as if it was typed on the card → { ok, error }; a mistake keeps the last line that worked playing */
    edit: function (text) { var m = drums.machine; return m && m.edit ? m.edit(text) : { ok: false, error: null }; },
    /** what Copy puts on the clipboard: startDrums("…", bpm) */
    get copyText() { var m = drums.machine; return m && m.copyText ? m.copyText() : ''; },
    /** drawRhythm(x, y, w, h, style, options) as a method */
    draw: function (x, y, w, h, style, o) { return drawRhythm(x, y, w, h, style, o); },
  };
  midi.drums = drums;
  function drumEmit(kind, cb, args) {
    callSketch(cb, args);
    var list = drumSubs[kind].slice();
    for (var i = 0; i < list.length; i++) { try { list[i].apply(g, args); } catch (e) { report(cb, e); } }
  }
  // ev (from the machine): ev.quiet — heard while hidden, or long ago (a frame loop that stalled): the clock and the cues
  // move, the per-step callback does not; ev.announce — the one bar start of a quiet stretch that is announced
  function drumStepped(i, n, ev) {
    var bar = Math.floor(n / 16) + 1, quiet = !!(ev && ev.quiet);
    drums.step = i; drums.bar = bar; drums.count = n;
    put('drumStep', i); put('drumBar', bar);
    for (var k = 0; k < cues.length; k++) {
      var c = cues[k];
      if (n === c.at || (c.period > 0 && n > c.at && (n - c.at) % c.period === 0)) {
        drums.lastCue = c.name; put('cueName', c.name);
        drumEmit('cue', 'cueFired', [c.name, bar]);
      }
    }
    if (i === 0 && (!quiet || ev.announce)) drumEmit('bar', 'barStarted', [bar]);
    if (!quiet) drumEmit('step', 'stepStarted', [i, bar]);
  }
  var DRUM_TS = { kickDetected: 'lastKickTs', snareDetected: 'lastSnareTs', hatDetected: 'lastHatTs' }, DRUM_HIT = { kickDetected: 'kick', snareDetected: 'snare', hatDetected: 'hat' };
  function drumHitIn(lane, v) {
    var ts = hitTs();
    if (DRUM_CB[lane]) { put(DRUM_TS[DRUM_CB[lane]], ts); hitSeq[DRUM_HIT[DRUM_CB[lane]]]++; }
    if (DRUM_BEAT[lane] && drums.count !== drumBeatAt) put('lastBeatTs', ts);
    drumEmit('hit', 'drumHit', [lane, v]);
    if (DRUM_CB[lane]) callSketch(DRUM_CB[lane], [v]);
    if (DRUM_BEAT[lane] && drums.count !== drumBeatAt) { drumBeatAt = drums.count; micSeq++; callSketch('beatDetected', [v]); }   // one beat per step
  }
  var phaseAt = -1, phaseNow = { bar: 0, beat: 0 };
  function drumPhaseNow() {
    var m = drums.machine, t = clock();
    if (clk && !(m && m.seq && m.seq.playing) && (following() || stoppedClock())) {   // no machine playing: the external clock's own phase (0.7; held where it stopped)
      var xp = clk.phaseAt(t / 1000);
      return xp ? { bar: xp.bar, beat: xp.beat } : phaseNow;
    }
    if (!m || !m.phase) return phaseNow;
    if (t - phaseAt > 1) { phaseAt = t; try { phaseNow = m.phase(); } catch (e) { /* */ } }   // read once a millisecond at most
    return phaseNow;
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
  // the callbacks land right before the sketch's draw() of the frame they are heard in: p5's own hook for that
  // (2.x: an addon's predraw; 1.x: registerMethod('pre')). Where p5 has neither, our own frame loop tells them.
  function drumsDeliver() {
    var m = drums.machine;
    if (!m || !m.deliver || drums.state !== 'on') return;
    try { m.deliver(); } catch (e) { report('drums', e); }
  }
  function hookPreDraw() {
    if (preDraw) return;
    var P = g.p5;
    if (!P) return;
    try {
      if (typeof P.registerAddon === 'function' && P.lifecycleHooks && P.lifecycleHooks.predraw) {
        P.registerAddon(function (p5, fn, lifecycles) { lifecycles.predraw = function () { drumsDeliver(); }; });
        preDraw = 'p5 2.x predraw';
      } else if (P.instance && typeof P.instance.registerMethod === 'function') {
        P.instance.registerMethod('pre', function () { drumsDeliver(); });
        preDraw = 'p5 1.x pre';
      }
    } catch (e) { dbg('no pre-draw hook', e); }
  }
  function ensureMachine() {
    if (machineP) return machineP;
    if (!doc || !doc.body) return Promise.resolve(null);
    setDrums('loading');
    machineP = ensureKit().then(function (k) {
      buildDrumCard();
      var host = drumCard.firstChild;
      var m = drumsMod.mountDrums(host, { signals: drumBus, engine: k, autoEnableEngine: false, onStep: drumStepped, bpm: drums.bpm,
        pattern: typeof drums.pattern === 'string' && !drumsMod.PATTERNS[drums.pattern] ? 'four on floor' : drums.pattern,
        clock: O.drums === 'frame' ? 'frame' : 'lookahead', lang: zh ? 'zh' : 'en', latency: O.drumlatency,
        onHit: function (voice, v) { drumHitIn(voice, v); }, onTakeover: takeoverHint,
        onRhythm: rhythmChangedIn, onLossy: lossyHint, onEditError: editHint, strudelComment: T.fromOAV,
        copyText: function (line, bpm) { return 'startDrums(' + JSON.stringify(line) + (bpm ? ', ' + Math.round(bpm * 100) / 100 : '') + ')'; } });
      drums.machine = m;
      if (O.drums !== 'frame') hookPreDraw();
      // the line over the grid and its editing come with @openav/pattern: for a preset too, so its grid shows as the line
      // it is (a few KB, loaded beside the drums; if it cannot load, the grid works as in 0.6)
      if (m.useRhythm) loadPattern().then(function (pm) { if (pm && pm.fromGrid) m.useRhythm(pm); }, function () { /* the grid alone, as 0.6 */ });
      return m;
    }).then(null, function (e) {
      machineP = null; setDrums('error');
      hint('modfail:drums', 'moduleFail', { name: '@openav/drums', host: hostOf(BASE) }, 'error');
      return null;
    });
    return machineP;
  }
  // ---- one line of rhythm: startDrums("bd*4, [~ sd]*2, hh*8"). The writing comes from TidalCycles / Strudel (strudel.cc);
  // @openav/pattern is an independent implementation from their public documentation, loaded the first time a line is used.
  var PRESETS = ['four on floor', 'breakbeat', 'half time', 'latin', 'sparse'];
  function presetLike(text) {
    var k = String(text).toLowerCase().replace(/[\s_-]+/g, '');
    for (var i = 0; i < PRESETS.length; i++) if (PRESETS[i].replace(/\s+/g, '') === k || (k === 'fouronthefloor' && i === 0)) return PRESETS[i];
    return null;
  }
  function loadPattern() {
    if (!patternModP) patternModP = load('packages/pattern/index.js').then(null, function (e) { patternModP = null; throw e; });
    return patternModP;
  }
  var CLOSE = { '[': ']', '<': '>', '(': ')', '{': '}' };
  function rhythmWords(text, err) {
    err = err || {};
    var code = String(err.code || ''), idx = Math.max(0, Math.min(text.length, err.index | 0)), len = Math.max(0, err.length | 0);
    var word = text.slice(idx, idx + Math.max(1, len)), ch = text.charAt(idx) || text.charAt(text.length - 1) || '';
    var line = text.slice(0, idx) + '⟦' + text.slice(idx, idx + len) + '⟧' + text.slice(idx + len);
    var key = ch === '.' && code !== 'bad-number' ? 'dot' : H.rhythmWhy[code] ? code : 'other';
    if (code === 'unclosed' && !CLOSE[ch]) { for (var j = idx; j >= 0; j--) if (CLOSE[text.charAt(j)]) { ch = text.charAt(j); break; } }
    var o = { n: idx + 1, ch: ch, word: word, close: CLOSE[ch] || ']', msg: err.message || code || '?', hint: err.hint || '', preset: presetLike(text) };
    var fixKey = o.preset && (code === 'unknown-word' || key === 'other') ? 'preset' : H.rhythmFix[key] ? key : 'other';
    return { n: o.n, line: '"' + line + '"', why: fill(H.rhythmWhy[key], o), fix: fill(H.rhythmFix[fixKey], o) };
  }
  function rhythmHint(text, err) { hint('rhythm:' + text, 'rhythmBad', rhythmWords(text, err), 'warn'); }
  // typing on the card: one card that follows the line being typed (a new mistake replaces it, a fixed line takes it away)
  function editHint(err, text) {
    unhint('rhythmEdit');
    for (var i = hintList.length - 1; i >= 0; i--) if (hintList[i].id === 'rhythmEdit') hintList.splice(i, 1);   // 🩺 lists the latest only
    if (err) hint('rhythmEdit', 'rhythmKeep', rhythmWords(String(text || ''), err), 'warn');
  }
  // the first click on a line the 16 steps cannot hold: say what goes; the next click rewrites it (↶ brings it back)
  function lossyHint(info) {
    var W = H.rhythmLossyWhat, l = (info && info.lost) || {}, parts = [];
    if (l.offGrid) parts.push(fill(W.offGrid, { n: l.offGrid }));
    if (l.varies) parts.push(fill(W.varies, { bar: info.bar }));
    if (l.random) parts.push(W.random);
    if (l.samples) parts.push(W.samples);
    if (l.stacked) parts.push(W.stacked);
    hint('rhythmLossy:' + info.text, 'rhythmLossy', { lost: parts.join(W.sep) }, 'info');
  }
  // the line changed (startDrums, a click on a cell, a line typed, ↶, the menu): rhythmChanged(src, how) and drums.on('rhythm')
  function rhythmChangedIn(src, info) {
    var how = (info && info.how) || 'code';
    if (keep.drums && src) { keep.drums.src = src; saveKeep(); }
    if (how !== 'code') unhint('rhythmTakeover');
    drumEmit('rhythm', 'rhythmChanged', [src, how]);
  }
  function takeoverHint(info) {
    var L = H.rhythmLost, parts = [];
    if (info.offGrid) parts.push(fill(L.offGrid, { n: info.offGrid }));
    if (info.dropped && info.dropped.length) parts.push(fill(L.dropped, { voices: info.dropped.map(function (v) { return drumsMod && drumsMod.drumName ? drumsMod.drumName(v, zh ? 'zh' : 'en') : v; }).join(zh ? '、' : ', ') }));
    if (info.varied) parts.push(fill(L.varied, { bar: info.bar }));
    hint('rhythmTakeover', null, { lost: parts.length ? parts.join(L.sep) : L.none, text: info.text }, 'info');
  }
  /** what startDrums(arg) plays: a promise of { pattern, text } (null: keep what plays). Names, grids, numbers, nothing:
   *  as in 0.5. Any other text is a line of rhythm; a mistake in it says where on a card and plays 'four on floor'. */
  function resolvePattern(p) {
    if (p == null) return Promise.resolve(null);
    if (typeof p !== 'string') return Promise.resolve({ pattern: p });
    return ensureDrumsModule().then(function (m) {
      if (m.PATTERNS[p]) return { pattern: p };
      if (/^[\sxX.|01-]+$/.test(p) && /[xX.1]/.test(p) && p.replace(/[\s|]/g, '').length >= 4 && !/^[\s~-]+$/.test(p)) {
        hint('rhythmGrid:' + p, 'rhythmGrid', { text: p }, 'warn');
        return { pattern: 'four on floor' };
      }
      if (rhythms[p]) return rhythms[p];
      return loadPattern().then(function (pm) {
        var c = null, text = p, bpm = null;
        // copied from strudel.cc: s("…") / sound("…") with .fast / .slow; .bank and the rest are said on a card, the line plays
        var st = typeof pm.fromStrudel === 'function' ? pm.fromStrudel(p) : null;
        if (st && st.strudel) {
          (st.ignored || []).forEach(function (call) { hint('rhythmBank:' + call, 'rhythmBank', { call: call }, 'info'); });
          (st.unsupported || []).forEach(function (call) { hint('rhythmChain:' + call, 'rhythmChain', { call: call.length > 60 ? call.slice(0, 57) + '…' : call }, 'info'); });
          if (!st.ok) { hint('rhythmNoS:' + p, 'rhythmNoS', null, 'warn'); return { pattern: 'four on floor' }; }
          text = st.src; bpm = st.bpm;
        }
        try { c = pm.compile(text); } catch (e) { c = { ok: false, error: { code: 'other', index: 0, length: 0, message: String((e && e.message) || e) } }; }
        if (!c || !c.ok || typeof c.eventsInBar !== 'function') { rhythmHint(text, c && c.error); return { pattern: 'four on floor' }; }
        return (rhythms[p] = { pattern: c, text: text, bpm: bpm });
      }, function () {
        hint('modfail:pattern', 'moduleFail', { name: '@openav/pattern', host: hostOf(BASE) }, 'error');
        return { pattern: 'four on floor' };
      });
    });
  }
  function startDrums(pattern, bpm) {
    if (typeof pattern === 'number' && bpm == null) { bpm = pattern; pattern = null; }
    if (pattern != null) drums.pattern = pattern;
    var bpmGiven = bpm != null && +bpm > 0;
    if (bpmGiven) drums.bpm = Math.max(30, Math.min(300, +bpm));
    drumsWanted = true;
    var req = ++drumReq;
    return ensureMachine().then(function (m) {
      if (!m || !drumsWanted) return false;
      return resolvePattern(pattern).then(function (r) {
        if (!drumsWanted) return false;
        if (req !== drumReq) return true;              // a later startDrums() is on its way: it decides what plays
        if (r && !(r.text && m.seq.mode === 'string' && m.seq.text === r.text)) m.setPattern(r.pattern, r.text ? { text: r.text } : undefined);
        if (r && r.bpm > 0 && !bpmGiven) drums.bpm = Math.max(30, Math.min(300, r.bpm));   // setcpm(110/4) in the copied code
        m.setBpm(drums.bpm);
        showDrums(true);
        if (!m.seq.playing) m.play(true);
        whenAudio(kitEnable);
        if (!audioAllowed()) setTimeout(function () { if (!audioOK && drums.state === 'on') hint('drumsClick', null, null, 'info'); }, 1200);
        syncDrums(); runDrums();
        return true;
      });
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
    if (keep.drums && keep.drums.bpm !== drums.bpm && drums.bpm > 0) { keep.drums.bpm = drums.bpm; saveKeep(); }
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
  // drumPhase / beatPhase: readers, like the microphone's names, so each read is as fresh as the moment it is read (a value
  // written once a frame would lag a frame behind the sound). A sketch's own drumPhase keeps it.
  function readerName(name, read) {
    if (name in g) { yielded.push(name); return; }
    try {
      Object.defineProperty(g, name, {
        configurable: true, enumerable: false, get: read,
        set: function (v) { Object.defineProperty(g, name, { value: v, writable: true, configurable: true, enumerable: true }); },
      });
    } catch (e) { /* a page that sealed its globals */ }
  }
  readerName('drumPhase', function () { return drumPhaseNow().bar; });
  readerName('beatPhase', function () { return drumPhaseNow().beat; });

  // ---- drawRhythm(x, y, w, h, style): the rhythm drawn ON the canvas, so a recording (which takes the canvas alone) has it.
  // 'grid' is the card's 16 steps with a playhead; 'circle' one ring of 16 per drum with a hand turned by drumPhase; 'spiral' the
  // last few bars wound outwards, now at the tip. A hit lights up the moment it is heard (the same clock drumPhase reads), off-grid
  // hits (triplets) sit where they fall. Drawn with p5's own shapes inside push() / pop(), so 2D and WEBGL, p5 1.x and 2.x alike;
  // in WEBGL (0, 0) is the middle of the canvas: drawRhythm(-width / 2, -height / 2, width, height) fills it.
  var RHYTHM_COLORS = { kick: '#ff6b6b', snare: '#ffd166', hat: '#6fd3ff', clap: '#c792ff', openhat: '#7ff0c8', pedalhat: '#5fb4d9', rim: '#ffb38a',
    lowtom: '#f08bd0', tom: '#e57bff', hightom: '#b18cff', crash: '#ffa94d', ride: '#a0e7a0', cowbell: '#f2e394' };
  var RHYTHM_LANES = ['kick', 'snare', 'hat', 'clap'];
  var rhythmRows = { key: null, rows: RHYTHM_LANES };
  /** the drums as drawRhythm needs them: rows (voices that play), bar (1-based), phase 0..1, pos (bars since the start), events(bar) */
  function rhythmState() {
    var m = drums.machine, ph = drumPhaseNow(), pos = ph && ph.pos != null ? +ph.pos || 0 : 0;
    var events = function (b) { try { return m && m.barEvents && b >= 1 ? m.barEvents(b) || [] : []; } catch (e) { return []; } };
    var key = m ? (m.src ? m.src() : '') + '|' + (m.seq && m.seq.mode) + '|' + (m.seq && m.seq.pattern) : null;
    if (key !== rhythmRows.key) {
      var used = {}, rows = [], order = m && m.voices ? m.voices() : RHYTHM_LANES;
      for (var b = 1; b <= 8; b++) events(b).forEach(function (e) { used[e.voice] = 1; });
      order.forEach(function (v) { if (used[v]) rows.push(v); });
      Object.keys(used).forEach(function (v) { if (rows.indexOf(v) < 0) rows.push(v); });
      rhythmRows = { key: key, rows: rows.length ? rows : RHYTHM_LANES };
    }
    return { rows: rhythmRows.rows, pos: pos, bar: Math.floor(pos) + 1, phase: pos - Math.floor(pos), playing: drums.state === 'on', events: events };
  }
  function drawRhythm(x, y, w, h, style, opts) {
    var P = g, gl = false;
    if (typeof P.push !== 'function' || typeof P.rect !== 'function' || typeof P.color !== 'function') return false;   // no p5 (global mode) here
    if (style && typeof style === 'object') { opts = style; style = opts.style; }
    opts = opts || {};
    style = style === 'circle' || style === 'spiral' ? style : 'grid';
    try { gl = !!(P.drawingContext && typeof P.drawingContext.getParameter === 'function'); } catch (e) { /* */ }
    var W = +P.width || 400, Hh = +P.height || 400;
    if (x == null || y == null || w == null || h == null) {     // no box given: a strip along the bottom (grid), the middle (circle, spiral)
      var side = Math.min(W, Hh) * 0.8;
      if (style === 'grid') { x = W * 0.05; y = Hh * 0.8; w = W * 0.9; h = Hh * 0.15; } else { x = (W - side) / 2; y = (Hh - side) / 2; w = side; h = side; }
      if (gl) { x -= W / 2; y -= Hh / 2; }
    }
    x = +x; y = +y; w = +w; h = +h;
    if (!(w > 0) || !(h > 0)) return false;
    var S = rhythmState();
    P.push();
    try {
      P.colorMode(P.RGB, 255, 255, 255, 255);
      P.rectMode(P.CORNER); P.ellipseMode(P.CENTER);
      var cache = {};
      var col = function (v) {
        if (cache[v]) return cache[v];
        var c = opts.color != null ? opts.color : opts.colors && opts.colors[v] != null ? opts.colors[v] : RHYTHM_COLORS[v] || '#cfd6e4';
        return (cache[v] = P.color(c));
      };
      var fade = function (c, a) { return P.color(P.red(c), P.green(c), P.blue(c), P.alpha(c) * Math.max(0, Math.min(1, a))); };
      var white = P.color(255);
      var lit = function (c, k) { return k > 0 ? P.lerpColor(c, white, 0.65 * k) : c; };
      var off = P.color(opts.off != null ? opts.off : 'rgba(255,255,255,0.10)');
      var offBeat = P.color(P.red(off), P.green(off), P.blue(off), Math.min(255, P.alpha(off) * 1.8));   // the four beats a little brighter
      var head = P.color(opts.playhead != null ? opts.playhead : '#ffffff');
      // how lit a hit at bar-position t is now: 1 the moment it is heard, gone two 16ths later
      var glow = function (t) { var a = (S.pos - t) * 16; return S.playing && a >= 0 && a < 2 ? 1 - a / 2 : 0; };
      if (opts.bg != null) { P.noStroke(); P.fill(opts.bg); P.rect(x, y, w, h); }
      var rows = S.rows, n = rows.length, base = S.bar - 1;
      if (style === 'grid') {
        var cw = w / 16, ch = h / n, gap = Math.max(1, Math.min(cw, ch) * 0.14);
        P.noStroke();
        for (var r = 0; r < n; r++) for (var i = 0; i < 16; i++) { P.fill(i % 4 === 0 ? offBeat : off); P.rect(x + i * cw + gap / 2, y + r * ch + gap / 2, cw - gap, ch - gap); }
        S.events(S.bar).forEach(function (e) {
          var r = rows.indexOf(e.voice); if (r < 0) return;
          var k = glow(base + e.pos), grow = k * gap * 0.5;
          P.fill(lit(col(e.voice), k));
          P.rect(x + e.pos * w + gap / 2 - grow, y + r * ch + gap / 2 - grow, cw - gap + grow * 2, ch - gap + grow * 2);
        });
        if (S.playing && opts.playhead !== false) { P.stroke(head); P.strokeWeight(Math.max(1.5, cw * 0.08)); P.line(x + S.phase * w, y, x + S.phase * w, y + h); }
      } else if (style === 'circle') {
        var cx = x + w / 2, cy = y + h / 2, R = Math.min(w, h) / 2, r0 = R * 0.3, t = (R - r0) / n, TAU = Math.PI * 2, gapA = TAU / 16 * 0.12;
        var sector = function (ri, ro, a0, a1) {
          P.beginShape();
          for (var k = 0; k <= 4; k++) { var a = a0 + (a1 - a0) * k / 4; P.vertex(cx + Math.cos(a) * ro, cy + Math.sin(a) * ro); }
          for (k = 4; k >= 0; k--) { a = a0 + (a1 - a0) * k / 4; P.vertex(cx + Math.cos(a) * ri, cy + Math.sin(a) * ri); }
          P.endShape(P.CLOSE);
        };
        P.noStroke();
        for (var q = 0; q < n; q++) for (var j = 0; j < 16; j++) {
          var a0 = -Math.PI / 2 + j * TAU / 16;
          P.fill(j % 4 === 0 ? offBeat : off); sector(r0 + q * t + t * 0.08, r0 + (q + 1) * t - t * 0.08, a0 + gapA / 2, a0 + TAU / 16 - gapA / 2);
        }
        S.events(S.bar).forEach(function (e) {
          var q = rows.indexOf(e.voice); if (q < 0) return;
          var k = glow(base + e.pos), a0 = -Math.PI / 2 + e.pos * TAU, pad = t * (0.08 - 0.08 * k);
          P.fill(lit(col(e.voice), k)); sector(r0 + q * t + pad, r0 + (q + 1) * t - pad, a0 + gapA / 2, a0 + TAU / 16 - gapA / 2);
        });
        if (opts.playhead !== false) {
          var ah = -Math.PI / 2 + S.phase * TAU;
          P.stroke(head); P.strokeWeight(Math.max(2, R * 0.02));
          P.line(cx, cy, cx + Math.cos(ah) * R, cy + Math.sin(ah) * R);
          P.noStroke(); P.fill(head); P.circle(cx, cy, Math.max(4, r0 * 0.35));
        }
      } else {
        // a spiral punch card: each hit a short band along the spiral, one lane per drum, the turns one bar apart, now at the tip
        var B = Math.max(1, Math.min(16, Math.round(+opts.bars || 4))), cx2 = x + w / 2, cy2 = y + h / 2, R2 = Math.min(w, h) / 2, rin = R2 * 0.14;
        var first = Math.floor(S.pos) - B + 1, turn = (R2 - rin) / (B + 0.5), TAU2 = Math.PI * 2, band = turn / n;
        var rad = function (tt) { return rin + (tt - first + 0.5) * turn; }, ang = function (tt) { return -Math.PI / 2 + (tt - Math.floor(tt)) * TAU2; };
        var pt = function (tt, dr) { var a = ang(tt), r = rad(tt) + dr; return [cx2 + Math.cos(a) * r, cy2 + Math.sin(a) * r]; };
        P.noFill(); P.stroke(off); P.strokeWeight(Math.max(1, turn * 0.04));
        P.beginShape();
        for (var u = first * 64; u <= (first + B) * 64; u++) { var g0 = pt(u / 64, -turn / 2); P.vertex(g0[0], g0[1]); }
        P.endShape();
        P.noStroke();
        for (var bb = Math.max(1, first + 1); bb <= first + B; bb++) {
          S.events(bb).forEach(function (e) {
            var q = rows.indexOf(e.voice); if (q < 0) return;
            var t0 = bb - 1 + e.pos, ahead = t0 > S.pos + 1e-9, k = glow(t0), age = (S.pos - t0) / B;
            var mid = (q - (n - 1) / 2) * band, half = band * (0.36 + 0.14 * k), t1 = t0 + 1 / 16 - 1 / 160;
            P.fill(fade(lit(col(e.voice), k), ahead ? 0.3 : 1 - 0.6 * Math.max(0, age)));
            P.beginShape();
            for (var z = 0; z <= 4; z++) { var o = pt(t0 + (t1 - t0) * z / 4, mid + half); P.vertex(o[0], o[1]); }
            for (z = 4; z >= 0; z--) { var i2 = pt(t0 + (t1 - t0) * z / 4, mid - half); P.vertex(i2[0], i2[1]); }
            P.endShape(P.CLOSE);
          });
        }
        if (opts.playhead !== false) { var tip = pt(S.pos, 0); P.fill(head); P.circle(tip[0], tip[1], Math.max(5, Math.min(turn * 0.5, band * 1.6))); }
      }
    } catch (e) { report('drawRhythm', e); }
    finally { P.pop(); }
    return true;
  }
  FUNCS.drawRhythm = function (x, y, w, h, style, o) { return drawRhythm(x, y, w, h, style, o); };

  // ---------------------------------------------------------------- recording: the canvas and what the sketch sounds like, one file
  // ⏺ in the 🎹 panel, or startRecording(): the p5 canvas (the canvas alone, so the 🎹, the drum grid and the cards never show
  // in the video) and every sound this file makes: startSound()'s instrument (Tone.js), the drum kit, the microphone while it is
  // on, and p5.sound 1.x. Each of them plays in an AudioContext of its own, and Chrome's MediaRecorder keeps only the first audio
  // track of a stream, so each is bridged through a MediaStream into one more context that mixes them into ONE track. The
  // speakers are not touched: they keep playing what they played. A source that comes on during a take (🔊 pressed halfway)
  // joins it. MP4 (H.264 + AAC: what Instagram and every editor take) where the browser writes it (Chrome 126+, Safari), else
  // WebM. The recorder is @openav/record's Recorder (packages/record/recorder.js), loaded from next to this file on the first ⏺.
  var REC_MIMES = ['video/mp4;codecs=avc1.640033,mp4a.40.2', 'video/mp4;codecs=avc1,mp4a', 'video/mp4',
    'video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'];   // @openav/record's VIDEO_MIMES, MP4 first (a test checks)
  var recSubs = { start: [], saved: [] };
  var recS = null, recSeq = 0, shotSeq = 0, recModP = null, recBtn = null, shotBtn = null, probeCv = null;
  var record = {
    state: 'off',                                   // off · starting (the recorder loading) · on · saving
    seconds: 0, last: null, fps: O.recfps, limit: O.reclimit,
    /** startRecording(10) or startRecording({ seconds, fps, mic: false, name, canvas, bitrate }) → Promise<boolean> (it started) */
    start: function (o) { return startRecording(o); },
    /** → Promise<info | null>, once the file is saved and checked (the same info recordingSaved(info) gets) */
    stop: function () { return stopRecording(); },
    /** the canvas as a PNG: downloaded (on a phone, a Share button) → Promise<{ name, blob, url, width, height, bytes } | null> */
    shot: function (o) { return saveShot(o); },
    /** what this browser can record: { recorder, mp4, webm, mime } (mime: what ⏺ asks for first) */
    formats: function () { return recFormats(); },
    /** record.on('start' | 'saved', fn) → off() */
    on: function (name, fn) {
      if (!recSubs[name]) throw new Error('[oav-p5] unknown record event "' + name + '" (' + Object.keys(recSubs).join(', ') + ')');
      recSubs[name].push(fn);
      return function () { var i = recSubs[name].indexOf(fn); if (i >= 0) recSubs[name].splice(i, 1); };
    },
    /** what the take hears right now: 'sound' · 'drums' · 'mic' · 'p5sound' */
    get sources() { return recS ? recLive(recS) : []; },
    _findings: recFindings, _mimes: REC_MIMES, _name: recName,   // for tests
  };
  midi.record = record;
  function pad2(x) { return (x < 10 ? '0' : '') + x; }
  function mmss(sec) { sec = Math.max(0, Math.floor(sec || 0)); return pad2(Math.floor(sec / 60)) + ':' + pad2(sec % 60); }
  function fmtBytes(b) { return b < 1048576 ? Math.max(1, Math.round(b / 1024)) + ' KB' : (b / 1048576).toFixed(1) + ' MB'; }
  function fmtMin(s) { return String(Math.round(s / 6) / 10); }
  function recEmit(name, args) { var l = recSubs[name].slice(); for (var i = 0; i < l.length; i++) { try { l[i].apply(g, args); } catch (e) { report('recordingSaved', e); } } }
  function setRec(s) { record.state = s; put('recordingIsOn', s === 'on'); paintRec(); }
  /** oav-20261015-183012.mp4 (oav-<title>-… with the title option or startRecording({ name })) */
  function recName(title, ext, d) {
    d = d || new Date();
    var t = String(title || O.title || '').replace(/[\s\\/:*?"<>|#%&{}$!'@+`=^~;,]+/g, '-').replace(/^[-.]+|[-.]+$/g, '').slice(0, 40);
    return 'oav-' + (t ? t + '-' : '') + d.getFullYear() + pad2(d.getMonth() + 1) + pad2(d.getDate()) + '-' + pad2(d.getHours()) + pad2(d.getMinutes()) + pad2(d.getSeconds()) + '.' + ext;
  }
  function recFormats() {
    var M = g.MediaRecorder, f = { recorder: typeof M === 'function', mp4: false, webm: false, mime: '' };
    if (!f.recorder || typeof M.isTypeSupported !== 'function') return f;
    for (var i = 0; i < REC_MIMES.length; i++) {
      var ok = false;
      try { ok = !!M.isTypeSupported(REC_MIMES[i]); } catch (e) { /* a check that throws is a no */ }
      if (!ok) continue;
      if (/^video\/mp4/.test(REC_MIMES[i])) f.mp4 = true; else f.webm = true;
      if (!f.mime) f.mime = REC_MIMES[i];
    }
    return f;
  }
  // 0.16 bit per pixel per frame: 1080p30 ≈ 10 Mb/s, enough for thin lines and particles; capped (16 Mb/s, 24 at 60 fps) so a
  // full-window retina canvas over five minutes still fits in the tab's memory. Instagram re-encodes it anyway.
  function recBitrate(w, h, fps) {
    var b = w * h * fps * 0.16, cap = fps > 30 ? 24e6 : 16e6;
    return Math.round(Math.max(4e6, Math.min(cap, b)) / 1e5) * 1e5;
  }
  /** the canvas to record: one given (a <canvas>, a p5.Graphics, a p5.Element), else p5's own: the largest visible p5Canvas.
   *  Not by id: p5 2.x numbers its canvases as it makes them (2.3.4's main one can be #defaultCanvas1) and gives a
   *  createGraphics() buffer the same class, hidden; a hidden canvas is never the one on screen. */
  function recCanvas(c) {
    if (c) return c.elt || c.canvas || c;
    if (!doc || !doc.getElementsByTagName) return null;
    var all = doc.getElementsByTagName('canvas'), best = null, score = 0;
    for (var i = 0; i < all.length; i++) {
      var x = all[i];
      if (x.closest && x.closest('#oav-p5-panel,#oav-p5-drums,#oav-p5-hints,#oav-p5-check')) continue;
      var sc = (x.offsetWidth || 0) * (x.offsetHeight || 0);
      if (sc && /(^|\s)p5Canvas(\s|$)/.test(x.className || '')) sc += 1e12;
      if (sc > score) { score = sc; best = x; }
    }
    return best;
  }
  // the mix: one more AudioContext, made inside the click that asked for it (so it runs), a limiter above -2 dBFS so several
  // sources at once never clip the file (below that it changes nothing), and a long analyser to know whether anything sounded
  function recMixer() {
    var Ctx = g.AudioContext || g.webkitAudioContext;
    if (!Ctx) return null;
    try {
      var ctx = new Ctx(), bus = ctx.createGain(), lim = ctx.createDynamicsCompressor(), dest = ctx.createMediaStreamDestination(), an = ctx.createAnalyser();
      lim.threshold.value = -2; lim.knee.value = 0; lim.ratio.value = 20; lim.attack.value = 0.002; lim.release.value = 0.15;
      an.fftSize = 32768;                           // 0.7 s a read, read every 0.25 s: no drum hit falls between two reads
      bus.connect(lim); lim.connect(dest); lim.connect(an);
      if (ctx.state === 'suspended' && ctx.resume) ctx.resume().then(null, function () {});
      return { ctx: ctx, bus: bus, dest: dest, an: an, buf: new Float32Array(an.fftSize), track: dest.stream.getAudioTracks()[0] || null };
    } catch (e) { dbg('no mix for the recording', e); return null; }
  }
  /** a source from another AudioContext into the mix, through a MediaStream: make() → { stream, off } */
  function recBridge(s, make) {
    var t = null;
    try {
      t = make();
      var src = s.mix.ctx.createMediaStreamSource(t.stream);
      src.connect(s.mix.bus);
      return { stream: t.stream, off: function () { try { src.disconnect(); } catch (e) { /* */ } try { t.off(); } catch (e) { /* */ } } };
    } catch (e) {
      if (t) { try { t.off(); } catch (x) { /* */ } }    // half made: undo the tap on the source's side
      dbg('recording: a source could not be tapped', e);
      return { failed: String((e && e.message) || e), off: function () {} };
    }
  }
  function p5soundOut() { try { var o = g.p5 && g.p5.soundOut && g.p5.soundOut.output; return o && o.context && typeof o.connect === 'function' ? o : null; } catch (e) { return null; } }
  function p5soundNew() { try { return !!(g.p5 && g.p5.p5soundNode && !g.p5.soundOut); } catch (e) { return false; } }
  // every sound this file makes, tapped where it leaves for the speakers; called at the start and four times a second, so a
  // source that comes on during the take joins it
  function recAttach(s) {
    if (!s.mix || s.done) return;
    var t = s.taps;
    if (!t.sound && sndOn && toneMod) {
      t.sound = recBridge(s, function () {
        var T = toneMod, out = typeof T.getDestination === 'function' ? T.getDestination() : T.Destination;
        var d = T.getContext().createMediaStreamDestination();   // Tone's own context (standardized-audio-context): a native node would not do
        out.connect(d);
        return { stream: d.stream, off: function () { out.disconnect(d); } };
      });
    }
    if (!t.drums && kit && kit.context && kit.output) {
      t.drums = recBridge(s, function () {
        var d = kit.context.createMediaStreamDestination(), out = kit.output;
        out.connect(d);
        return { stream: d.stream, off: function () { out.disconnect(d); } };
      });
    }
    var ms = s.mic && mic.state === 'on' && micAudio && micAudio.source && micAudio.source.mediaStream;
    if (ms && (!t.mic || t.mic.stream !== ms)) {     // a microphone stopped and started again is a new stream
      if (t.mic) t.mic.off();
      t.mic = recBridge(s, function () { return { stream: ms, off: function () {} }; });
    }
    var p5o = !t.p5sound && p5soundOut();
    if (p5o) {
      t.p5sound = recBridge(s, function () {
        var d = p5o.context.createMediaStreamDestination();
        p5o.connect(d);
        return { stream: d.stream, off: function () { p5o.disconnect(d); } };
      });
    }
  }
  function recLive(s) { return Object.keys(s.taps).filter(function (k) { return s.taps[k] && !s.taps[k].failed; }); }
  function recCleanup(s) {
    if (s.done) return;
    s.done = true;
    clearTimeout(s.timer); clearInterval(s.tick);
    Object.keys(s.taps).forEach(function (k) { try { s.taps[k].off(); } catch (e) { /* */ } });
    if (s.mix) { try { s.mix.ctx.close().then(null, function () {}); } catch (e) { /* */ } }
  }
  /** the brightest of 48 × 48 averaged cells of a canvas or a video frame, 0..255; null where it cannot be read */
  function lumaMax(src) {
    if (!doc || !doc.createElement) return null;
    try {
      if (!probeCv) { probeCv = doc.createElement('canvas'); probeCv.width = probeCv.height = 48; }
      var c = probeCv.getContext('2d', { willReadFrequently: true });
      c.fillStyle = '#000'; c.fillRect(0, 0, 48, 48);
      c.drawImage(src, 0, 0, 48, 48);
      var d = c.getImageData(0, 0, 48, 48).data, m = 0;
      for (var i = 0; i < d.length; i += 4) { var v = d[i] > d[i + 1] ? d[i] : d[i + 1]; if (d[i + 2] > v) v = d[i + 2]; if (v > m) m = v; }
      return m;
    } catch (e) { return null; }
  }
  // the iOS check (WebKit 229611: Safari has recorded a WebGL canvas as a black video): three frames of the file itself, at
  // 30 %, 60 % and 90 %, compared with what the canvas showed while recording; null when this browser cannot decode them
  function recFrames(blob, dur) {
    return new Promise(function (done) {
      var v, url, at = [0.3, 0.6, 0.9], i = 0, m = -1, over = false, t = null;
      var end = function () { if (over) return; over = true; clearTimeout(t); try { v.removeAttribute('src'); v.load(); } catch (e) { /* */ } try { URL.revokeObjectURL(url); } catch (e) { /* */ } done(m >= 0 ? m : null); };
      try {
        v = doc.createElement('video'); url = URL.createObjectURL(blob);
        v.muted = true; v.playsInline = true; v.setAttribute('playsinline', ''); v.preload = 'auto';
        v.onerror = end;
        v.onloadeddata = function () { v.currentTime = Math.max(0.05, dur * at[0]); };
        v.onseeked = function () { var x = lumaMax(v); if (x != null && x > m) m = x; if (++i >= at.length) end(); else v.currentTime = Math.max(0.05, dur * at[i]); };
        t = setTimeout(end, 4000);
        v.src = url;
      } catch (e) { end(); }
    });
  }
  /** what is worth saying about a take: hint ids, in order. f: { bytes, format, audio, peak, on: [sources that were on], live, frames } */
  function recFindings(f) {
    var out = [], on = (f.on || []).length > 0;
    if (f.bytes < 4096) out.push('recEmpty');
    if (f.format === 'webm') out.push('recWebm');
    if (on && !f.audio) out.push('recNoAudio');
    else if (on && !(f.peak > 1e-4)) out.push('recSilent');          // -80 dBFS: nothing at all reached the mix
    if (f.frames != null && f.live != null && f.frames <= 12 && f.live >= 40) out.push('recBlack');
    return out;
  }
  function recPhone() { try { return !!(g.matchMedia && g.matchMedia('(pointer: coarse)').matches); } catch (e) { return false; } }
  function recFile(blob, name) { try { return new File([blob], name, { type: String(blob.type || '').split(';')[0] }); } catch (e) { return null; } }
  function recCanShare(file) { try { return !!(file && typeof nav.share === 'function' && typeof nav.canShare === 'function' && nav.canShare({ files: [file] })); } catch (e) { return false; } }
  function recDownload(url, name) {
    if (!url || !doc || !doc.body) return false;
    var a = doc.createElement('a');
    a.href = url; a.download = name; a.style.display = 'none';
    a.addEventListener('click', function (e) { e.stopPropagation(); });   // not a click on the sketch (p5 listens on window)
    doc.body.appendChild(a);
    try { a.click(); } catch (e) { /* */ }
    setTimeout(function () { if (a.parentNode) a.parentNode.removeChild(a); }, 0);
    return true;
  }
  // Web Share needs the tap itself (a take that stopped by a timer has none), so on a phone the card carries the button
  function recShare(file, url, name) {
    try { nav.share({ files: [file], title: name }).then(null, function (e) { if (!e || e.name !== 'AbortError') recDownload(url, name); }); }
    catch (e) { recDownload(url, name); }
  }
  /** a computer: the file is downloaded at once; a phone that can share files: Share and Download buttons on the card */
  function recDeliver(blob, url, name) {
    var file = recFile(blob, name), share = recCanShare(file), phone = recPhone() && share && HINTS_ON && !!(doc && doc.body), actions = [];
    if (!phone) recDownload(url, name);
    if (share) actions.push({ label: T.share, fn: function () { recShare(file, url, name); } });
    if (phone) actions.push({ label: T.download, fn: function () { recDownload(url, name); } });
    return { phone: phone, actions: actions };
  }
  function recLabel(list) { return list.map(function (k) { return H.rec.src[k] || k; }).join(H.rec.sep); }
  function recFormatLabel(mime, ext) {
    var v = /avc1|h264/i.test(mime) ? 'H.264' : /vp09|vp9/i.test(mime) ? 'VP9' : /vp08|vp8/i.test(mime) ? 'VP8' : /av01/i.test(mime) ? 'AV1' : '';
    var a = /mp4a|aac/i.test(mime) ? 'AAC' : /opus/i.test(mime) ? 'Opus' : '';
    return (ext === 'mp4' ? 'MP4' : 'WebM') + (v ? (zh ? '（' : ' (') + v + (a ? (zh ? '＋' : ' + ') + a : '') + (zh ? '）' : ')') : '');
  }
  function loadRecorder() {
    if (!recModP) recModP = load('packages/record/recorder.js').then(null, function (e) { recModP = null; throw Object.assign(e || new Error('load'), { oavLoad: true }); });
    return recModP;
  }
  function startRecording(arg) {
    if (O.record === 'off') return Promise.resolve(false);   // the option is a promise to the page
    if (recS) return Promise.resolve(record.state === 'on' || record.state === 'starting');
    var o = typeof arg === 'number' ? { seconds: arg } : arg && typeof arg === 'object' ? arg : {};
    var canvas = recCanvas(o.canvas);
    if (!canvas) { hint('recNoCanvas', null, null, 'error'); return Promise.resolve(false); }
    var M = g.MediaRecorder;
    if (typeof M !== 'function' || typeof canvas.captureStream !== 'function') {
      hint('recNone', null, { why: typeof M !== 'function' ? H.rec.whyRecorder : H.rec.whyCapture }, 'error');
      return Promise.resolve(false);
    }
    var sec = +o.seconds > 0 ? Math.min(+o.seconds, O.reclimit) : 0;
    if (+o.seconds > O.reclimit) sayInfo('[oav-p5] startRecording(' + o.seconds + '): one take is ' + O.reclimit + ' s at most (the option reclimit)');
    var s = recS = { id: ++recSeq, canvas: canvas, seconds: sec, fps: +o.fps > 0 ? Math.min(60, +o.fps) : O.recfps, name: o.name,
      mic: o.mic != null ? !!o.mic : O.record !== 'nomic', taps: {}, on: {}, peak: 0, live: null, ticks: 0, rec: null, mix: recMixer() };
    record.seconds = 0;
    setRec('starting');
    return loadRecorder().then(function (m) {
      if (recS !== s || s.done) return false;        // stopped while the recorder was loading
      recAttach(s);
      var tracks = s.mix && s.mix.track ? [s.mix.track] : [];
      var bps = +o.bitrate > 0 ? +o.bitrate : recBitrate(canvas.width, canvas.height, s.fps);
      var f = recFormats(), tries = [], r = null, err = null;
      if (f.mime) tries.push(f.mime);
      if (f.mp4 && f.webm) {                         // an MP4 the browser says yes to and then refuses (no encoder on this machine): WebM
        for (var k = 0; k < REC_MIMES.length; k++) {
          var yes = false;
          try { yes = /webm/.test(REC_MIMES[k]) && g.MediaRecorder.isTypeSupported(REC_MIMES[k]); } catch (e) { /* */ }
          if (yes) { tries.push(REC_MIMES[k]); break; }
        }
      }
      tries.push('');                                // last: whatever the browser records by default
      for (var i = 0; i < tries.length && !r; i++) {
        var x = null;
        try {
          x = new m.Recorder({ canvas: canvas, fps: s.fps, audioTracks: tracks, videoBitsPerSecond: bps, mimeType: tries[i] });
          x.start({ timeslice: 1000 });
          r = x;
        } catch (e) {
          if (x && x._own) x._own.forEach(function (tr) { try { tr.stop(); } catch (y) { /* */ } });
          err = err || e;
          if (e && e.name === 'SecurityError') break;   // a tainted canvas: no format will do
        }
      }
      if (!r) throw err || new Error('MediaRecorder');
      s.rec = r; s.t0 = clock();
      setRec('on');
      if (sec) s.timer = setTimeout(function () { if (recS === s) stopRecording(); }, sec * 1000);
      else s.timer = setTimeout(function () { if (recS !== s) return; hint('recLimit:' + s.id, 'recLimit', { m: fmtMin(O.reclimit) }, 'info'); stopRecording(); }, O.reclimit * 1000);
      s.tick = setInterval(recTick, 250);
      var live = recLive(s);
      hint('recStart:' + s.id, 'recStart', {
        len: sec ? fill(H.rec.secs, { n: sec }) : fill(H.rec.max, { m: fmtMin(O.reclimit) }),
        audio: live.length ? recLabel(live) : H.rec.none, micNote: live.indexOf('mic') >= 0 ? H.rec.micNote : '',
        stop: sec ? fill(H.rec.stopSecs, { n: sec }) : recPhone() ? H.rec.stopPhone : H.rec.stopBtn }, 'info', { ttl: 8000 });
      if (p5soundNew()) hint('recP5sound', null, null, 'info');
      sayInfo('[oav-p5] recording ' + canvas.width + '×' + canvas.height + ' @' + s.fps + ' fps, ' + (r.mimeType || 'the browser\'s format') + ', ' + Math.round(bps / 1e5) / 10 + ' Mb/s; sound: ' + (live.join(', ') || 'none yet'));
      recEmit('start', [{ width: canvas.width, height: canvas.height, fps: s.fps, type: r.mimeType, seconds: sec }]);
      return true;
    }).then(null, function (e) {
      if (recS === s) { recCleanup(s); recS = null; setRec('off'); }
      if (e && e.oavLoad) hint('modfail:record', 'moduleFail', { name: '@openav/record', host: hostOf(BASE) }, 'error');
      else if (e && e.name === 'SecurityError') hint('recTainted', null, null, 'error');
      else hint('recError:' + s.id, 'recError', { msg: (e && (e.message || e.name)) || String(e) }, 'error');
      return false;
    });
  }
  function recTick() {
    var s = recS;
    if (!s || !s.rec || s.done) return;
    record.seconds = (clock() - s.t0) / 1000;
    recAttach(s);
    if (sndOn) s.on.sound = 1;
    if (kitStarted && drums.state === 'on') s.on.drums = 1;
    if (s.taps.mic && !s.taps.mic.failed && mic.state === 'on') s.on.mic = 1;
    var mx = s.mix;
    if (mx) {
      try {
        mx.an.getFloatTimeDomainData(mx.buf);
        for (var i = 0, p = s.peak, b = mx.buf; i < b.length; i++) { var a = b[i] < 0 ? -b[i] : b[i]; if (a > p) p = a; }
        s.peak = p;
      } catch (e) { /* */ }
    }
    // what the canvas shows, for the black-take check: a few looks (at 0.25, 0.5, 1, 2, 4 … s), none once it is known to show something
    var n = ++s.ticks;
    if ((s.live == null || s.live < 40) && (n & (n - 1)) === 0) { var l = lumaMax(s.canvas); if (l != null) s.live = Math.max(s.live || 0, l); }
    if (s.rec.error && !s.failed) {
      s.failed = true;
      var er = s.rec.error;
      hint('recError:' + s.id, 'recError', { msg: (er && (er.message || er.name)) || String(er) }, 'error');
      stopRecording();
      return;
    }
    paintRec();
  }
  function stopRecording() {
    var s = recS;
    if (!s) return Promise.resolve(null);
    if (s.stopping) return s.stopping;
    if (!s.rec) { recCleanup(s); recS = null; setRec('off'); unhint('recStart:' + s.id); return Promise.resolve(null); }   // still loading: nothing recorded
    recTick();                                       // the last quarter second's level
    clearTimeout(s.timer); clearInterval(s.tick);
    setRec('saving');
    s.stopping = s.rec.stop().then(function (r) { return recFinish(s, r); }).then(null, function (e) {
      recCleanup(s);
      report('the recording', e);
      return null;
    }).then(function (info) {
      if (recS === s) recS = null;
      setRec('off');
      return info;
    });
    return s.stopping;
  }
  function recFinish(s, r) {
    recCleanup(s);
    unhint('recStart:' + s.id);
    var mime = r.mimeType || '', ext = /mp4/i.test(mime) || r.ext === 'mp4' ? 'mp4' : 'webm';
    var info = {
      name: recName(s.name, ext), blob: r.blob, url: null, type: mime, format: ext, bytes: r.bytes || 0,
      seconds: Math.round((r.durationMs || 0) / 100) / 10, width: ext === 'mp4' ? r.width - (r.width % 2) : r.width,
      height: ext === 'mp4' ? r.height - (r.height % 2) : r.height, fps: r.fps, audio: !!r.audio, heard: s.peak > 1e-4,
      sources: recLive(s), warnings: [] };
    record.seconds = info.seconds;
    try { if (r.blob && g.URL && URL.createObjectURL) info.url = URL.createObjectURL(r.blob); } catch (e) { /* */ }
    var old = record.last;
    record.last = info;
    if (old && old.url) setTimeout(function () { try { URL.revokeObjectURL(old.url); } catch (e) { /* */ } }, 60000);   // one take's URL lives until a minute after the next
    var out = r.blob ? recDeliver(r.blob, info.url, info.name) : { phone: false, actions: [] };
    hint('recSaved:' + s.id, 'recSaved', {
      name: info.name, format: recFormatLabel(mime, ext), size: fmtBytes(info.bytes), wh: info.width + '×' + info.height,
      dur: info.seconds < 60 ? info.seconds.toFixed(1) + H.rec.sec : mmss(info.seconds),
      sound: !info.audio ? H.rec.noTrack : info.heard ? H.rec.heard : H.rec.silent,
      next: out.phone ? H.rec.phone : ext === 'webm' ? H.rec.savedWebm : H.rec.saved }, 'info', { actions: out.actions });
    var f = { bytes: info.bytes, format: ext, audio: info.audio, peak: s.peak, on: Object.keys(s.on), live: s.live, frames: null };
    var said = {};
    var say = function (list) {
      list.forEach(function (k) {
        if (said[k]) return;
        said[k] = 1;
        hint(k + ':' + s.id, k, { browser: browserName(), src: recLabel(f.on), why: H.rec.whyAudio, size: fmtBytes(info.bytes) },
          k === 'recEmpty' || k === 'recBlack' ? 'error' : 'warn');
      });
    };
    say(recFindings(f));
    var look = s.live != null && s.live >= 40 && r.blob && doc && g.URL ? recFrames(r.blob, info.seconds) : Promise.resolve(null);
    return look.then(function (fm) {
      f.frames = fm;
      info.warnings = recFindings(f);
      say(info.warnings);
      sayInfo('[oav-p5] saved ' + info.name + ': ' + info.width + '×' + info.height + ', ' + info.seconds + ' s, ' + fmtBytes(info.bytes) + ', ' + (info.audio ? (info.heard ? 'with sound (' + info.sources.join(', ') + ')' : 'silent') : 'no audio track') + (info.warnings.length ? ' · ' + info.warnings.join(', ') : ''));
      callSketch('recordingSaved', [info]);
      recEmit('saved', [info]);
      return info;
    });
  }
  function saveShot(o) {
    o = o || {};
    var c = recCanvas(o.canvas);
    if (!c || typeof c.toBlob !== 'function') { hint('recNoCanvas', null, null, 'error'); return Promise.resolve(null); }
    var name = recName(o.name, 'png');
    return new Promise(function (ok) {
      try {
        c.toBlob(function (b) {
          if (!b) { ok(null); return; }
          var info = { name: name, blob: b, url: null, width: c.width, height: c.height, bytes: b.size };
          try { info.url = URL.createObjectURL(b); } catch (e) { /* */ }
          var out = recDeliver(b, info.url, name), id = ++shotSeq;
          hint('shot:' + id, 'shotSaved', { name: name, wh: c.width + '×' + c.height, next: out.phone ? H.rec.shotPhone : H.rec.shotSaved }, 'info', { actions: out.actions, ttl: out.phone ? 0 : 6000 });
          if (info.url && !out.phone) setTimeout(function () { try { URL.revokeObjectURL(info.url); } catch (e) { /* */ } }, 60000);
          ok(info);
        }, 'image/png');
      } catch (e) {
        if (e && e.name === 'SecurityError') hint('recTainted', null, null, 'error'); else report('📷', e);
        ok(null);
      }
    });
  }
  // ⏺ on the 🎹 itself while a take runs: a red dot and the time, for whoever has the panel closed; a click there stops it
  function paintRec() {
    var st = record.state, busy = st !== 'off';
    if (btn && btn.querySelector) {
      var dot = btn.querySelector('#oav-p5-rec-dot');
      if (busy && !dot) {
        dot = el('span', 'display:inline-flex;align-items:center;gap:4px;padding:2px 7px 2px 6px;border-radius:999px;background:rgba(224,60,50,.25);color:#ff6b5f;font:700 12px/1.2 ui-monospace,Menlo,monospace;white-space:nowrap');
        dot.id = 'oav-p5-rec-dot'; dot.title = T.recDot; dot.setAttribute('aria-label', T.recDot);
        dot.appendChild(el('span', 'font-size:11px', '●')); dot.appendChild(el('span', ''));
        btn.appendChild(dot);
      }
      if (dot && !busy) { if (dot.parentNode) dot.parentNode.removeChild(dot); }
      else if (dot) {
        dot.lastChild.textContent = st === 'on' ? mmss(record.seconds) : '…';
        dot.firstChild.style.opacity = st === 'on' && Math.floor(record.seconds * 2) % 2 ? '0.3' : '1';
      }
    }
    if (recBtn) {
      var label = st === 'on' ? fill(T.recStop, { t: mmss(record.seconds) }) : st === 'starting' ? T.recStarting : st === 'saving' ? T.recSaving : T.recOn;
      var cut = label.indexOf(' ');                  // ⏺ / ⏹ in red (a text font draws them white), the words as they are
      recBtn.textContent = '';
      recBtn.appendChild(el('span', 'color:#ff5a4f', label.slice(0, cut)));
      recBtn.appendChild(doc.createTextNode(label.slice(cut)));
      recBtn.style.background = st === 'on' ? 'rgba(224,60,50,.32)' : 'none';
      recBtn.style.borderColor = st === 'on' ? '#e06b5f' : 'rgba(255,255,255,.3)';
    }
  }
  FUNCS.startRecording = function (o) { return record.start(o); };
  FUNCS.stopRecording = function () { return record.stop(); };

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
  // the wiring table, one line: 旋鈕1 → radius（OPC） · 旋鈕2 → knob2（草圖；speed 用滑桿） · 打擊墊1 → trails（OPC）
  function wiringText() {
    var w = opcWiring(tableFor('screen')), parts = [], seen = {};
    w.forEach(function (x) { seen[x.control] = 1; parts.push(ctlLabel(x.control) + ' → ' + (x.sketch ? fill(T.readSlider, { read: x.control, opc: x.name }) : x.name + T.opcMark)); });
    Object.keys(READ).sort().forEach(function (c) { if (!seen[c]) parts.push(ctlLabel(c) + ' → ' + fill(T.readOnly, { read: c })); });
    return parts.length ? T.wired + (zh ? '：' : ': ') + parts.join(' · ') : '';
  }
  // one click handler on the window (capture), not on the button: a host page that re-renders its <body> after this file
  // ran leaves a copy of the 🎹 with no listeners; the id still finds it
  function onClick(e) {
    var b = e.target && e.target.closest && e.target.closest('#oav-p5-button');
    if (DEBUG && e.type === 'pointerdown') { var top = doc.elementFromPoint(e.clientX, e.clientY); dbg('pointerdown', Math.round(e.clientX), Math.round(e.clientY), 'target', e.target.tagName + '#' + e.target.id, 'top', top && (top.tagName + '#' + top.id), 'button is ours', doc.getElementById('oav-p5-button') === btn); }
    if (!b || e.type !== 'click') return;
    if (b !== btn) { dbg('the page replaced the 🎹: re-adopting the copy'); btn = b; fence(btn); paintButton(); }
    e.stopPropagation();
    if (e.target.closest('#oav-p5-rec-dot') && (record.state === 'on' || record.state === 'starting')) stopRecording();   // the red dot: stop
    else openPanel();
    try { btn.blur(); } catch (x) { /* */ }
  }
  function placeButton() {
    if (O.panel === 'off' || btn || !doc || !doc.body) return;
    g.addEventListener('click', onClick, true);
    if (DEBUG) g.addEventListener('pointerdown', onClick, true);
    btn = el('button', 'position:fixed;' + O.corner + ':10px;' + O.dock + ':' + EDGE + 'px;z-index:' + Z + ';display:flex;align-items:center;gap:6px;padding:6px 10px;' +
      'border-radius:999px;border:1px solid rgba(255,255,255,.3);background:rgba(18,18,22,.78);color:#fff;font:600 13px system-ui,sans-serif;' +
      'cursor:pointer;backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px)');
    btn.type = 'button'; btn.id = 'oav-p5-button';
    btn.appendChild(el('span', 'width:7px;height:7px;border-radius:50%;background:#8a8a8a;display:inline-block'));
    btn.appendChild(el('span', '', '🎹'));
    fence(btn);
    doc.body.appendChild(btn);
    paintButton(); paintRec(); paintExt();
    flushHints();
    if (O.panel === 'open' || keep.open) openPanel(true);
    restoreKept();
    // say once, in the console, what the controller is wired to (OPC variables are declared by now)
    var hint = function () { setTimeout(function () { var s = wiringText(); if (s) sayInfo('[oav-p5] ' + s); }, 0); };
    if (doc.readyState === 'complete') hint(); else g.addEventListener('load', hint);
    if (DEBUG) setTimeout(function () { dbg('2 s after placing: the 🎹 in the page is ours:', doc.getElementById('oav-p5-button') === btn, '| base', BASE); }, 2000);
  }
  function lift() {
    // the 🎹 and its cards move out of the panel's way only when the panel sits on their edge (docked there, or the
    // floating box still in its corner); a panel on the other edge, or dragged away, leaves them where they are
    var pl = place || { side: O.dock, x: null };   // (lift can run before the panel's placement is read)
    var fl = pl.side === 'float', open = panelOpen && dock, ph = open ? dock.getBoundingClientRect().height : 0;
    var h = open && (fl ? pl.x == null : pl.side === O.dock) ? ph + (fl ? 10 : 0) : 0;
    if (btn) btn.style[O.dock] = (EDGE + h) + 'px';
    if (hintBox) hintBox.style[O.dock] = (O.panel === 'off' ? EDGE : EDGE + 42) + h + 'px';
    if (drumCard) drumCard.style.top = open && pl.side === 'top' ? (10 + ph) + 'px' : '';   // below a panel docked at the top
  }
  function openPanel(want) {
    if (!doc || O.panel === 'off') return Promise.resolve(null);
    var on = want == null ? !panelOpen : !!want;
    keep.open = on; saveKeep();
    if (!on) { panelOpen = false; if (dock) dock.style.display = 'none'; lift(); return Promise.resolve(null); }
    if (O.hardware === 'click' && midi.hardware === 'off') connectHardware();
    if (!loading) loading = buildDock();
    // show the panel at once (the controller itself can take seconds to arrive the first time), so a click is never silent
    panelOpen = true; dock.style.display = 'block'; lift(); dbg('panel open; controller', view ? 'ready' : 'loading');
    return loading.then(function (d) { if (panelOpen) { d.style.display = 'block'; if (legend) { legend.textContent = wiringText(); legend.title = legend.textContent; } lift(); } return d; });
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
    x.addEventListener('click', function () { if (keep.drums) { keep.drums = null; saveKeep(); } stopDrums(); });
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

  // ---- where the panel sits (2026-10-20 哲宇：「浮動面板可以預設在下方……但是可以切換嗎？因為它現在會遮擋畫面……
  // 可以浮動拖曳，然後又可以切換大小」): docked full width at the bottom or the top, or a floating box dragged by its bar;
  // and how tall it may grow (small, medium, large). The 🎹 and its cards keep the dock option. The panel starts where the
  // viewer last put it (this browser remembers), else where the sketch's dock option says, else at the bottom; compact
  // (Strudel) starts as the floating box in the corner.
  var PLACE_KEY = 'oav-p5-panel-place', CAPS = { dock: [0.3, 0.5, 0.7], float: [0.32, 0.42, 0.6] }, WIDTHS = [560, 640, 820];   // a floating box narrower than 560 px is all buttons
  var place = (function () {
    var p = { side: O.compact ? 'float' : opt('dock', null) != null ? O.dock : 'bottom', size: 1, x: null, y: null }, s = null;
    try { s = JSON.parse(g.localStorage.getItem(PLACE_KEY) || 'null'); } catch (e) { /* private window, or storage blocked */ }
    if (s && typeof s === 'object') {
      if (s.side === 'top' || s.side === 'bottom' || s.side === 'float') p.side = s.side;
      if (s.size === 0 || s.size === 1 || s.size === 2) p.size = s.size;
      if (typeof s.x === 'number' && typeof s.y === 'number' && isFinite(s.x) && isFinite(s.y)) { p.x = s.x; p.y = s.y; }
    }
    return p;
  })();
  var placeBtn = null, sizeBtn = null, placeBar = null, fitView = null;
  // ---- what the viewer had on, kept across a reload of the same page (2026-10-20 哲宇：「command + Enter 重整作品之後每次都要
  // 重按一下 oav 的按鈕，然後還要切換到鼓機開啟顯示，很繁瑣」): the panel open, and drums the viewer started from the panel,
  // with the line of rhythm and the tempo they ended on. A sketch that starts its own drums keeps its own.
  var KEEP_KEY = 'oav-p5-keep:' + (function () { try { return g.location.pathname; } catch (e) { return ''; } })();
  var keep = (function () { try { var v = JSON.parse(g.localStorage.getItem(KEEP_KEY) || 'null'); return v && typeof v === 'object' ? v : {}; } catch (e) { return {}; } })();
  var keptJson = JSON.stringify(keep);
  function saveKeep() { var j = JSON.stringify(keep); if (j === keptJson) return; keptJson = j; try { g.localStorage.setItem(KEEP_KEY, j); } catch (e) { /* */ } }
  function keepDrums() {
    if (!keep.drums) return;
    if (drums.state === 'off') { keep.drums = null; saveKeep(); return; }
    var src = '';
    try { src = drums.machine && drums.machine.src ? drums.machine.src() : ''; } catch (e) { /* */ }
    if (src) keep.drums.src = src;
    if (drums.bpm > 0) keep.drums.bpm = drums.bpm;
    saveKeep();
  }
  function restoreKept() {
    // after the sketch's setup(): drums it started itself win
    setTimeout(function () { if (keep.drums && !drumsWanted && drums.state === 'off') startDrums(keep.drums.src || null, keep.drums.bpm || null); }, 800);
  }
  if (typeof g.addEventListener === 'function') g.addEventListener('pagehide', keepDrums);
  function capNow() { return CAPS[place.side === 'float' ? 'float' : 'dock'][place.size]; }
  function savePlace() { try { g.localStorage.setItem(PLACE_KEY, JSON.stringify(place)); } catch (e) { /* */ } }
  function clampX(x) { return Math.round(Math.max(0, Math.min(g.innerWidth - 120, x))); }
  function clampY(y) { return Math.round(Math.max(0, Math.min(g.innerHeight - 40, y))); }
  function paintPlace() {
    if (placeBtn) { placeBtn.textContent = T.place[place.side]; placeBtn.title = T.placeTitle; }
    if (sizeBtn) { sizeBtn.textContent = T.size + T.sizes[place.size]; sizeBtn.title = T.sizeTitle; }
    if (placeBar) { placeBar.style.cursor = place.side === 'float' ? 'move' : ''; placeBar.style.touchAction = place.side === 'float' ? 'none' : ''; }
  }
  function placeDock() {
    if (!dock) return;
    var st = dock.style, line = '1px solid rgba(255,255,255,.18)';
    st.left = st.right = st.top = st.bottom = st.width = st.border = st.borderTop = st.borderBottom = st.borderRadius = '';
    st.maxHeight = Math.round(capNow() * 100) + 'vh';
    if (place.side === 'float') {
      st.width = 'min(' + WIDTHS[place.size] + 'px,calc(100vw - 20px))'; st.border = line; st.borderRadius = '12px';
      if (place.x != null) { st.left = clampX(place.x) + 'px'; st.top = clampY(place.y) + 'px'; } else { st[O.corner] = '10px'; st[O.dock] = EDGE + 'px'; }
    } else {
      st.left = '0'; st.right = '0'; st[place.side] = '0';
      st[place.side === 'top' ? 'borderBottom' : 'borderTop'] = line;
    }
    paintPlace();
    if (fitView) fitView();
    lift();
  }
  function dragDock(bar) {
    bar.addEventListener('pointerdown', function (e) {
      if (place.side !== 'float' || (e.button != null && e.button !== 0) || (e.target.closest && e.target.closest('button,select,input,a,label'))) return;
      var r = dock.getBoundingClientRect(), dx = e.clientX - r.left, dy = e.clientY - r.top, moved = false, id = e.pointerId;
      try { bar.setPointerCapture(id); } catch (x) { /* */ }
      var move = function (ev) {
        moved = true; place.x = clampX(ev.clientX - dx); place.y = clampY(ev.clientY - dy);
        dock.style.right = dock.style.bottom = ''; dock.style.left = place.x + 'px'; dock.style.top = place.y + 'px'; lift();
      };
      var up = function () {
        bar.removeEventListener('pointermove', move); bar.removeEventListener('pointerup', up); bar.removeEventListener('pointercancel', up);
        try { bar.releasePointerCapture(id); } catch (x) { /* */ }
        if (moved) savePlace();
      };
      bar.addEventListener('pointermove', move); bar.addEventListener('pointerup', up); bar.addEventListener('pointercancel', up);
      e.preventDefault();
    });
  }
  if (typeof g.addEventListener === 'function') g.addEventListener('resize', function () { if (dock && place.side === 'float' && place.x != null) { dock.style.left = clampX(place.x) + 'px'; dock.style.top = clampY(place.y) + 'px'; } });

  function buildDock() {
    dock = el('div', 'position:fixed;z-index:' + (Z - 1) + ';overflow:auto;display:none;' +
      'background:rgba(14,14,18,.92);padding:6px 10px 10px;box-sizing:border-box;backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px)');
    dock.id = 'oav-p5-panel';
    fence(dock);
    var bar = el('div', 'display:flex;flex-wrap:wrap;gap:6px 8px;align-items:center;margin-bottom:4px;font:600 12px system-ui,sans-serif;color:#ddd' + (O.corner === 'left' ? ';flex-direction:row-reverse' : ''));
    placeBar = bar; dragDock(bar);
    legend = el('div', 'flex:1 1 160px;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#9fd8ff;font-weight:500');
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
    drumBtn.addEventListener('click', function () {
      if (drums.state === 'on' || drums.state === 'stopped' || drums.state === 'loading') { keep.drums = null; saveKeep(); stopDrums(); }
      else { keep.drums = {}; saveKeep(); startDrums().then(keepDrums); }
    });
    setDrums(drums.state);
    var ck = el('button', small, T.check); ck.id = 'oav-p5-check-button'; ck.type = 'button';
    ck.addEventListener('click', function () { check(); });
    recBtn = el('button', small + ';font-variant-numeric:tabular-nums'); recBtn.id = 'oav-p5-rec-button'; recBtn.type = 'button'; recBtn.title = T.recTitle;
    recBtn.addEventListener('click', function () { if (record.state === 'on' || record.state === 'starting') stopRecording(); else if (record.state === 'off') startRecording(); });
    shotBtn = el('button', small, T.shot); shotBtn.id = 'oav-p5-shot-button'; shotBtn.type = 'button'; shotBtn.title = T.shotTitle;
    shotBtn.addEventListener('click', function () { saveShot(); });
    if (O.record === 'off') { recBtn.style.display = 'none'; shotBtn.style.display = 'none'; }
    paintRec();
    extChip = el('div', 'flex:0 1 auto;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#9fd8ff;font-weight:600;display:none');
    extChip.id = 'oav-p5-ext';
    bar.appendChild(legend); bar.appendChild(extChip); paintExt(); bar.appendChild(micBtn); bar.appendChild(sndBtn); bar.appendChild(drumBtn); bar.appendChild(recBtn); bar.appendChild(shotBtn);
    placeBtn = el('button', small); placeBtn.id = 'oav-p5-place'; placeBtn.type = 'button';
    placeBtn.addEventListener('click', function () { place.side = { bottom: 'top', top: 'float', float: 'bottom' }[place.side]; savePlace(); placeDock(); });
    sizeBtn = el('button', small); sizeBtn.id = 'oav-p5-size'; sizeBtn.type = 'button';
    sizeBtn.addEventListener('click', function () { place.size = (place.size + 1) % 3; savePlace(); placeDock(); });
    bar.appendChild(ph); bar.appendChild(ck); bar.appendChild(placeBtn); bar.appendChild(sizeBtn); bar.appendChild(cl);
    dock.appendChild(bar);
    placeDock();
    sndRow = el('div', 'display:none;margin:0 0 6px'); sndRow.id = 'oav-p5-sound';
    dock.appendChild(sndRow);
    paintSound();
    var wait = el('div', 'padding:18px;text-align:center;color:#aaa;font:500 13px system-ui,sans-serif', T.loading);
    dock.appendChild(wait);
    doc.body.appendChild(dock);
    return load('packages/midi/element.js').then(function () {
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
        var fl = place.side === 'float', room = g.innerHeight * capNow() - (fl ? 96 : 86);   // the panel's cap minus its bar and the element's picker row
        view.style.width = Math.max(fl ? 240 : 320, Math.min(dock.clientWidth - 20, room * f.w / f.h)) + 'px';
        view.style.margin = '0 auto';
      };
      var follow = function () {                          // the device on screen decides what knob1 means for the screen
        screenProfile = view.profileData || null; delete tables.screen;
        if (legend) { legend.textContent = wiringText(); legend.title = legend.textContent; }
        if (relay && view.profileData) relay.config('midi', { profile: view.profileData.id });
        fit();
      };
      view.addEventListener('ready', follow); view.addEventListener('profilechange', follow); g.addEventListener('resize', fit);
      fitView = fit;
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
    if (O.link) return O.link;                           // linked pages share their room with the phones: one QR plays them all
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
      load('packages/relay/index.js').then(function (m) {
        var url = O.relay + (O.relay.indexOf('?') >= 0 ? '&' : '?') + 'role=runner&room=' + encodeURIComponent(room) + '&id=p5-' + Math.random().toString(36).slice(2, 6);
        relay = new m.RelayClient({
          role: 'runner', room: room, url: url,
          onStatus: function (c) { if (c.status === 'open') c.config('midi', { profile: (view && view.profileData && view.profileData.id) || O.profile }); },
          // the phone's MIDI tab sends `midi/virtual` = the raw bytes it played, and which device it shows (it also
          // sends midi/note/…, midi/cc/… for shows — taking only the bytes means every press counts once)
          onSignal: function (name, value) { if (name === 'midi/virtual' && value && Array.isArray(value.data)) input(value.data, 'phone', value.device ? 'id:' + value.device : 'screen'); },
        });
        relay.connect();
      }, function (e) { if (g.console && !QUIET) console.warn('[oav-p5] relay client did not load', e); });
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

  // ---------------------------------------------------------------- 🩺 a check-up to screenshot: microphone, MIDI, sound, wiring
  // A student posts the card in Discord and the teacher sees at once what this browser did: the same facts as text, a copy
  // button, and a link to the site's full device check (/check/).
  var C = zh ? { title: '🩺 oav-p5 體檢', page: '頁面', frame: '嵌在別的網頁裡（iframe）', top: '直接打開', browser: '瀏覽器', mic: '麥克風', midi: 'MIDI',
    sound: '聲音', drums: '鼓機', wiring: '接線', own: '草圖自己的名字', hints: '提示過', none: '沒有', copy: '複製文字', copied: '已複製', more: '更完整的裝置檢查 →',
    states: { off: '關著', asking: '等你允許', on: '開著', denied: '被擋下', unavailable: '拿不到', waiting: '等你點一下', loading: '載入中', error: '出錯', stopped: '停著',
      connected: '已連上', 'no device': '沒偵測到裝置', ready: '好了', idle: '還沒開始' }, webMidiNo: '這個瀏覽器沒有 Web MIDI', last: '最後收到', bar: '第 {n} 小節',
    rec: '錄影', recMp4: '可以錄 MP4（IG 可以直接用）', recWebm: '只能錄 WebM（IG 不收：換新版 Chrome 或 Safari）', recNone: '這個瀏覽器不能錄', recOff: '關掉了（record=off）',
    recMax: '最長 {m} 分鐘', recNoMic: '不收麥克風', recNow: '錄影中', recLast: '上一段',
    ext: '外部程式', extNone: '沒有程式向 OAV Virtual MIDI 要過 MIDI（這頁要是在 oav-p5 載入之前就開過 MIDI，重新整理、讓 oav-p5 先載）', extNoShim: '虛擬埠關著（shim=off）',
    extAsked: 'OAV Virtual MIDI 被要過 {n} 次', extListen: '輸入有 {n} 個在聽', extOut: '輸出收到 {n} 則（最近 {what}，{ago} 秒前）', extOutNone: '輸出還沒收到東西',
    extClock: '時鐘 {bpm} BPM（{state}{lead}）', extClockLead: ' · 鼓機跟著', extClockNone: '沒有外部時鐘', extEcho: '擋下回音 {n} 則',
    extLink: 'link 房間 {room}（{state}{peers}{trip}{late}）', extPeers: ' · 另 {n} 頁', extTrip: ' · 單程約 {ms} ms', extLate: ' · 晚到 {n} 則',
    clockStates: { running: '跑著', stopped: '停著', lost: '斷了', none: '沒有' }, linkStates: { open: '連上', connecting: '連線中', closed: '斷線', off: '關著' },
    clockFrame: '逐幀推進（drums=frame）', clockAhead: '提前排程（{beat} 心跳、提前 {ahead} 秒、輸出延遲 {lat} ms）', clockLate: '畫面太忙排晚了 {n} 下，提前量已拉到 0.3 秒', clockNoPre: '回呼由 OAV 自己的每幀叫（沒接上 p5 的 draw 前）' }
    : { title: '🩺 oav-p5 check-up', page: 'Page', frame: 'inside another page (iframe)', top: 'opened directly', browser: 'Browser', mic: 'Microphone', midi: 'MIDI',
    sound: 'Sound', drums: 'Drums', wiring: 'Wiring', own: "The sketch's own names", hints: 'Hints shown', none: 'none', copy: 'Copy text', copied: 'Copied', more: 'Full device check →',
    states: { off: 'off', asking: 'waiting for permission', on: 'on', denied: 'blocked', unavailable: 'unavailable', waiting: 'waiting for a click', loading: 'loading', error: 'failed', stopped: 'stopped',
      connected: 'connected', 'no device': 'no device found', ready: 'ready', idle: 'not started' }, webMidiNo: 'no Web MIDI in this browser', last: 'last', bar: 'bar {n}',
    rec: 'Recording', recMp4: 'MP4 (ready for Instagram)', recWebm: 'WebM only (not for Instagram: use a recent Chrome or Safari)', recNone: 'this browser cannot record', recOff: 'off (record=off)',
    recMax: 'up to {m} min', recNoMic: 'microphone left out', recNow: 'recording', recLast: 'last take',
    ext: 'Other programs', extNone: 'no program has asked OAV Virtual MIDI for MIDI (if this page opened MIDI before oav-p5 loaded, reload so oav-p5 comes first)', extNoShim: 'the virtual port is off (shim=off)',
    extAsked: 'OAV Virtual MIDI handed out {n}×', extListen: '{n} listening on its input', extOut: 'its output got {n} (last {what}, {ago} s ago)', extOutNone: 'nothing on its output yet',
    extClock: 'clock {bpm} BPM ({state}{lead})', extClockLead: ' · the drums follow', extClockNone: 'no external clock', extEcho: '{n} echo(es) held back',
    extLink: 'link room {room} ({state}{peers}{trip}{late})', extPeers: ' · {n} other page(s)', extTrip: ' · one way ≈ {ms} ms', extLate: ' · {n} late',
    clockStates: { running: 'running', stopped: 'stopped', lost: 'lost', none: 'none' }, linkStates: { open: 'connected', connecting: 'connecting', closed: 'disconnected', off: 'off' },
    clockFrame: 'moved by the frames (drums=frame)', clockAhead: 'scheduled ahead ({beat} heartbeat, {ahead} s ahead, output latency {lat} ms)', clockLate: '{n} hit(s) handed over late (a busy frame): 0.3 s ahead from then on', clockNoPre: "callbacks from OAV's own frame loop (no p5 pre-draw hook)" };
  function st(x) { return C.states[x] || x; }
  // the drum clock, for the check-up: which heartbeat, how far ahead, the output latency the timing allows for, late hits
  function clockText(c) {
    if (!c || c.clock === 'frame') return C.clockFrame;
    var t = fill(C.clockAhead, { beat: c.heartbeat === 'worker' ? 'Worker' : c.heartbeat === 'interval' ? 'setInterval' : c.heartbeat,
      ahead: c.lookahead, lat: Math.round((c.latency || 0) * 1000) });
    if (c.heartbeat === 'interval' && c.why) t += zh ? '（' + c.why + '）' : ' (' + c.why + ')';
    if (c.extended) t += ' · ' + fill(C.clockLate, { n: c.late });
    if (!c.preDraw) t += ' · ' + C.clockNoPre;
    return t;
  }
  function browserName() {
    var ua = (nav && nav.userAgent) || '', m = /(Edg|OPR|Firefox|Chrome|Version)\/(\d+)/.exec(ua);
    var name = m ? ({ Edg: 'Edge', OPR: 'Opera', Version: 'Safari' }[m[1]] || m[1]) + ' ' + m[2] : ua.slice(0, 40);
    var os = /iPad/.test(ua) ? 'iPad' : /iPhone/.test(ua) ? 'iPhone' : /Android/.test(ua) ? 'Android' : /Mac OS X/.test(ua) ? 'macOS' : /Windows/.test(ua) ? 'Windows' : /Linux/.test(ua) ? 'Linux' : '';
    return name + (os ? ' · ' + os : '');
  }
  function checkup() {
    var framed = false;
    try { framed = g.self !== g.top; } catch (e) { framed = true; }
    var href = ''; try { href = g.location.origin + g.location.pathname; } catch (e) { /* */ }
    var own = hintList.filter(function (h) { return /^own:/.test(h.id); }).map(function (h) { return h.id.slice(4); });
    var r = {
      version: OAV_P5_VERSION, time: new Date().toISOString(),
      page: { url: href, framed: framed, secure: g.isSecureContext !== false, p5: g.p5 && g.p5.prototype ? (g.p5.VERSION || g.p5.prototype.VERSION || '?') : null },
      browser: browserName(),
      microphone: { state: mic.state, error: mic.error, level: Math.round(mic.level * 100) / 100, db: Math.round(mic.db), floor: Math.round(mic.floor), sensitivity: mic.sensitivity },
      midi: { webMidi: !!realRequest, hardware: midi.hardware, devices: midi.devices.slice(), last: midi.last ? { type: midi.last.type, value: midi.last.note != null ? midi.last.note : midi.last.cc, source: midi.last.source } : null },
      sound: { state: snd.state, instrument: snd.instrument, status: snd.status.state, error: snd.error },
      drums: { state: drums.state, bar: drums.bar, bpm: drums.bpm, pattern: typeof drums.pattern === 'string' ? drums.pattern : 'custom', cues: cues.length, clock: drums.machine ? drums.clock : null, src: drums.src },
      wiring: wiringText(), own: own,
      hints: hintList.map(function (h) { return h.what; }),
    };
    r.external = externalInfo();
    var rf = recFormats(), last = record.last;
    r.recording = { state: record.state, option: O.record, recorder: rf.recorder, mp4: rf.mp4, webm: rf.webm, mime: rf.mime, fps: O.recfps, limit: O.reclimit,
      last: last ? { name: last.name, format: last.format, seconds: last.seconds, bytes: last.bytes, audio: last.audio, heard: last.heard, warnings: last.warnings.slice() } : null };
    var d = new Date(), two = function (x) { return (x < 10 ? '0' : '') + x; };
    var L = [C.title + ' ' + r.version + ' · ' + d.getFullYear() + '-' + two(d.getMonth() + 1) + '-' + two(d.getDate()) + ' ' + two(d.getHours()) + ':' + two(d.getMinutes()),
      C.page + (zh ? '：' : ': ') + (r.page.url || '?') + ' · ' + (framed ? C.frame : C.top) + (r.page.secure ? '' : ' · http') + (r.page.p5 ? ' · p5 ' + r.page.p5 : ''),
      C.browser + (zh ? '：' : ': ') + r.browser,
      C.mic + (zh ? '：' : ': ') + st(mic.state) + (mic.error ? '（' + mic.error + '）' : '') + (mic.state === 'on' ? ' · micLevel ' + r.microphone.level + ' · ' + r.microphone.db + ' dB' : ''),
      C.midi + (zh ? '：' : ': ') + (realRequest ? st(midi.hardware === 'waiting' ? 'no device' : midi.hardware) + (midi.devices.length ? ' ' + midi.devices.join(', ') : '') : C.webMidiNo) +
        (r.midi.last ? ' · ' + C.last + ' ' + r.midi.last.type + ' ' + r.midi.last.value + ' ← ' + r.midi.last.source : ''),
      C.sound + (zh ? '：' : ': ') + st(snd.state) + (snd.instrument ? ' · ' + snd.instrument + '（' + st(r.sound.status) + '）' : '') + (snd.error ? ' · ' + snd.error : ''),
      C.drums + (zh ? '：' : ': ') + st(drums.state) + (drums.state === 'on' ? ' · ' + fill(C.bar, { n: drums.bar }) + ' · ' + Math.round(drums.bpm) + ' bpm' : '') + (drums.machine ? ' · ' + clockText(drums.clock) : '') + (r.drums.src ? ' · "' + r.drums.src + '"' : ''),
      C.rec + (zh ? '：' : ': ') + (O.record === 'off' ? C.recOff : (rf.mp4 ? C.recMp4 : rf.webm ? C.recWebm : C.recNone) +
        (rf.mp4 || rf.webm ? ' · ' + O.recfps + ' fps · ' + fill(C.recMax, { m: fmtMin(O.reclimit) }) + (O.record === 'nomic' ? ' · ' + C.recNoMic : '') : '') +
        (record.state === 'on' ? ' · ' + C.recNow + ' ' + mmss(record.seconds) : '') +
        (last ? ' · ' + C.recLast + ' ' + last.name + (zh ? '（' : ' (') + last.seconds + ' s, ' + fmtBytes(last.bytes) + ', ' + (last.audio ? (last.heard ? H.rec.heard : H.rec.silent) : H.rec.noTrack) + (zh ? '）' : ')') : '')),
      C.ext + (zh ? '：' : ': ') + externalText(r.external),
      C.wiring + (zh ? '：' : ': ') + (r.wiring ? r.wiring.replace(/^[^:：]*[:：]\s*/, '') : C.none),
      C.own + (zh ? '：' : ': ') + (own.length ? own.join(', ') : C.none),
      C.hints + (zh ? '：' : ': ') + (r.hints.length ? r.hints.join('；') : C.none)];
    r.text = L.join('\n');
    return r;
  }
  // 🩺 "Other programs": did anything take the virtual port (the silent failure when Strudel opened MIDI first), what came
  // out of it, the clock, the link — only OAV's own state and the browser's, nothing of the other program is read
  function msgName(b) {
    if (!b || !b.length) return '?';
    var s = b[0], t = s & 0xF0;
    if (s === 0xF8) return 'clock'; if (s === 0xFA) return 'start'; if (s === 0xFB) return 'continue'; if (s === 0xFC) return 'stop'; if (s === 0xF2) return 'song position';
    if (t === 0x90 && b[2]) return 'noteOn ' + b[1]; if (t === 0x80 || t === 0x90) return 'noteOff ' + b[1]; if (t === 0xB0) return 'cc ' + b[1] + ' = ' + b[2];
    if (t === 0xE0) return 'pitchBend'; return '0x' + s.toString(16);
  }
  function externalInfo() {
    var vp = virtualPort, ci = midi.clock.info, li = midi.link.info;
    return { shim: O.shim !== 'off', asked: vp ? vp.requests || 0 : 0, listening: vp && vp.input ? vp.input.listening || 0 : 0,
      out: ext.out, last: ext.outLast ? msgName(ext.outLast) : null, ago: ext.outLast ? Math.round((nowMs() - ext.outAt) / 100) / 10 : null, echoes: ext.echoes,
      clock: { state: ci.state, bpm: ci.bpm, following: !!(ci.state === 'running' && drums.machine && drums.machine.seq && drums.machine.seq.playing && machineUp()), source: ci.source },
      link: li, strudel: onStrudel };
  }
  function externalText(x) {
    var parts = [];
    if (!x.shim) parts.push(C.extNoShim);
    else if (!x.asked) parts.push(C.extNone);
    else {
      parts.push(fill(C.extAsked, { n: x.asked }));
      if (x.listening) parts.push(fill(C.extListen, { n: x.listening }));
      parts.push(x.out ? fill(C.extOut, { n: x.out, what: x.last, ago: x.ago }) : C.extOutNone);
    }
    parts.push(x.clock.state === 'none' ? C.extClockNone : fill(C.extClock, { bpm: x.clock.bpm == null ? '?' : Math.round(x.clock.bpm * 10) / 10,
      state: C.clockStates[x.clock.state] || x.clock.state, lead: x.clock.following ? C.extClockLead : '' }));
    if (x.echoes) parts.push(fill(C.extEcho, { n: x.echoes }));
    if (x.link) parts.push(fill(C.extLink, { room: x.link.room, state: C.linkStates[x.link.state] || x.link.state,
      peers: x.link.state === 'open' ? fill(C.extPeers, { n: x.link.peers || 0 }) : '', trip: x.link.trip != null ? fill(C.extTrip, { ms: x.link.trip }) : '',
      late: x.link.late ? fill(C.extLate, { n: x.link.late }) : '' }));
    return parts.join(' · ');
  }
  var checkCard = null;
  function check(opts) {
    var r = checkup();
    if (g.console) console.info(r.text);
    if (opts && opts.show === false || !doc || !doc.body) return r;
    if (checkCard && checkCard.parentNode) checkCard.parentNode.removeChild(checkCard);
    checkCard = el('div', 'position:fixed;inset:0;z-index:' + (Z + 3) + ';display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.55)');
    checkCard.id = 'oav-p5-check';
    fence(checkCard);
    var box = el('div', 'background:#15161b;color:#e8e8ee;border:1px solid rgba(255,255,255,.2);border-radius:14px;padding:14px 16px;max-width:min(560px,calc(100vw - 32px));max-height:80vh;overflow:auto;font:500 13px/1.55 system-ui,sans-serif');
    var pre = el('pre', 'margin:0 0 10px;white-space:pre-wrap;word-break:break-word;font:500 12.5px/1.6 ui-monospace,Menlo,monospace;color:#e8e8ee', r.text);
    var row = el('div', 'display:flex;gap:8px;align-items:center;flex-wrap:wrap');
    var small = 'padding:4px 10px;border-radius:8px;border:1px solid rgba(255,255,255,.3);background:none;color:#fff;cursor:pointer;font:inherit';
    var cp = el('button', small, C.copy); cp.type = 'button';
    cp.addEventListener('click', function () { try { nav.clipboard.writeText(r.text).then(function () { cp.textContent = C.copied; }); } catch (e) { /* select the text by hand */ } });
    var more = el('a', 'color:#9fd8ff;margin-left:auto', C.more); more.href = 'https://openaudiovisual.com/' + (zh ? 'zh/' : '') + 'check/'; more.target = '_blank'; more.rel = 'noopener';
    var x = el('button', small, T.close); x.type = 'button'; x.addEventListener('click', function () { checkCard.style.display = 'none'; });
    row.appendChild(cp); row.appendChild(x); row.appendChild(more);
    box.appendChild(pre); box.appendChild(row); checkCard.appendChild(box);
    checkCard.addEventListener('click', function (e) { if (e.target === checkCard) checkCard.style.display = 'none'; });
    doc.body.appendChild(checkCard);
    return r;
  }
  midi.check = check;

  // ---------------------------------------------------------------- values over time: lag · env · speed · spring · trail (0.7)
  // TouchDesigner's Lag, Trigger, Speed, Spring, Trail, Slope and Count CHOPs, written the p5 way: one call in draw(), nothing
  // to declare. `circle(x, y, 50 + lag(micLevel, 0.03, 0.4) * 300)` opens at once when someone speaks and closes slowly.
  // The math is @openav/chop (packages/chop: pure, frame-rate independent, tested with a fake clock), loaded from next to this
  // file the first time one of these is called; until it arrives (a few frames, while the microphone and the drums are still
  // arriving too) each returns its input as it is. Seconds are seconds: 30 fps and 144 fps draw the same curve.
  //
  // Which memory a call uses, with nothing declared (immediate mode): the Nth unnamed lag() in a draw() is the Nth lag slot,
  // every frame; spring(), speed(), trail() … are counted each on their own. A string at the end names the slot instead —
  // lag(micLevel, 0.03, 0.4, 'mic') — and a named slot is the same one wherever it is called. When the number of unnamed calls
  // changes between two frames (a call inside an if, a loop that grows), order no longer finds the right memory: a card says
  // so, and that kind switches to matching each call by the line it is written on (its call site; the order of the calls on
  // one line), keeping every slot whose line it knows. The frame in which the order broke may have handed a call its
  // neighbour's memory: that one step is undone (each slot keeps its state from before the frame), so a speed() keeps its
  // own angle; what that frame drew is the only trace. An if / else with one call on each side keeps the count and is not
  // seen: name those.
  // Outside draw() (setup, mousePressed …) an unnamed call has no place among the frame's calls: it returns its input
  // (speed 0, trail []) and says so once. env('kick'), trigger() and count('kick') are about events, not places: anywhere.
  var CHOP_FNS = ['lag', 'env', 'trigger', 'speed', 'spring', 'trail', 'slope', 'count', 'scope', 'drawTrail'];
  var chopKinds = {};                                  // kind → { list (by order), site (by call site, once order broke), named, i, prev }
  var chop = {
    state: 'off',                                     // off · loading · on · error (@openav/chop did not load: everything passes through)
    module: null,
    /** every slot in use: [{ kind, key, mode: 'order' | 'site' | 'name', value }] (for a check-up, for tests) */
    slots: function () {
      var out = [];
      Object.keys(chopKinds).forEach(function (k) {
        var K = chopKinds[k], v = function (s) { return s.s && s.s.value; };
        K.list.forEach(function (s, i) { if (s) out.push({ kind: k, key: '#' + (i + 1), mode: 'order', value: v(s) }); });
        if (K.site) Object.keys(K.site).forEach(function (key) { out.push({ kind: k, key: key, mode: 'site', value: v(K.site[key]) }); });
        Object.keys(K.named).forEach(function (key) { out.push({ kind: k, key: key, mode: 'name', value: v(K.named[key]) }); });
      });
      return out;
    },
    /** forget a named slot (reset('spin')), or every slot (reset()) */
    reset: function (name) {
      if (name == null) { Object.keys(chopKinds).forEach(function (k) { delete chopKinds[k]; }); return; }
      Object.keys(chopKinds).forEach(function (k) { delete chopKinds[k].named[name]; });
    },
    _kinds: chopKinds,
  };
  midi.chop = chop;
  var chopModP = null;
  function chopMod() {                                  // the module, or null (asked for the first time: it is on its way)
    if (chop.module) return chop.module;
    if (!chopModP) {
      chop.state = 'loading';
      chopModP = load('packages/chop/index.js').then(function (m) { chop.module = m; chop.state = 'on'; return m; }, function () {
        chop.state = 'error';
        hint('modfail:chop', 'moduleFail', { name: '@openav/chop', host: hostOf(BASE) }, 'error');
        return null;
      });
    }
    return null;
  }
  // -- the frame: p5's frameCount says when a new one began; its time is the clock at the first call in it (seconds)
  var cf = { frame: null, now: 0, at: -1e9, seq: 0, n: 0 };
  function p5inst() { try { var P = g.p5; return P && P.instance && typeof P.instance === 'object' ? P.instance : null; } catch (e) { return null; } }
  function inDraw() { var p = p5inst(); return !p || !!p._inUserDraw; }   // no p5 here (Hydra): every call is a frame's
  function chopTick() {
    var t = clock(), p = p5inst();
    var fc = p && typeof p.frameCount === 'number' ? p.frameCount : typeof g.frameCount === 'number' ? g.frameCount : null;
    if (fc === null) { if (t - cf.at > 4) cf.seq++; fc = 'x' + cf.seq; }   // no frameCount: calls 4 ms apart are another frame
    cf.at = t;
    if (fc !== cf.frame) chopFrame(fc, t);
    return cf.now;
  }
  function chopFrame(fc, t) {
    var ended = cf.n;
    cf.frame = fc; cf.now = t / 1000; cf.n++;
    Object.keys(chopKinds).forEach(function (k) {
      var K = chopKinds[k];
      if (!K.site && K.prev >= 0 && K.i !== K.prev && cf.n > 3) chopReorder(k, K, K.i, K.prev, ended);
      K.prev = K.i; K.i = 0; K.occ = {};
    });
    if (cf.n % 300 === 0) chopSweep(cf.now);
  }
  // -- call sites: the line of the sketch a call is written on, from a stack trace (only when a slot is made, or once the
  //    order broke: ~2 µs a call). Our own frames are the ones in this file.
  function frameFile(line) { var m = /(?:\(|@|\s|^)([^\s()@]+?):\d+(?::\d+)?\)?\s*$/.exec(line); return m ? m[1] : ''; }
  var OWN_FILE = (function () { try { var s = String(new Error().stack || '').split('\n'); for (var i = 0; i < s.length; i++) { var f = frameFile(s[i]); if (f) return f; } } catch (e) { /* */ } return ''; })();
  function callSite() {
    if (!OWN_FILE) return '';
    var lim = Error.stackTraceLimit, s;
    try { Error.stackTraceLimit = 12; s = String(new Error().stack || ''); } catch (e) { s = ''; } finally { Error.stackTraceLimit = lim; }
    var lines = s.split('\n');
    for (var i = 0; i < lines.length; i++) { var f = frameFile(lines[i]); if (f && f !== OWN_FILE) return lines[i].trim(); }
    return '';
  }
  function chopReorder(kind, K, n, m, ended) {
    hint('chopOrder:' + kind, 'chopOrder', { fn: kind, n: n, m: m, example: CHOP_EX[kind] || CHOP_EX.lag }, 'info');
    if (!OWN_FILE) return;                             // no stack traces here: it stays by order
    var site = {}, occ = {};
    K.list.forEach(function (s) {
      if (!s || !s.at || s.born === ended) return;      // made in the frame the order broke: whose it is, nobody knows
      if (s.stepN === ended && s.undo) { chopUnsnap(s.s, s.undo.st); s.t = s.undo.t; }   // that frame it may have served a neighbour: undone
      var key = s.at + '#' + (occ[s.at] = (occ[s.at] || 0) + 1);   // the line it was made on (the oldest one there first)
      if (!site[key]) site[key] = s;
    });
    K.site = site; K.list = [];
  }
  // a slot's state before this frame's step, for that undo: plain fields, arrays copied (Lag, Speed, Spring, Trail … are no more)
  function chopSnap(o) { var c = {}; for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) c[k] = Array.isArray(o[k]) ? o[k].slice() : o[k]; return c; }
  function chopUnsnap(o, c) { for (var k in c) o[k] = Array.isArray(c[k]) ? c[k].slice() : c[k]; }
  function chopSweep(now) {                            // a sketch with many names (one per particle) forgets the ones it stopped calling
    Object.keys(chopKinds).forEach(function (k) {
      var K = chopKinds[k];
      [K.named, K.site].forEach(function (map) {
        if (!map) return;
        var keys = Object.keys(map);
        if (keys.length > 32) keys.forEach(function (key) { if (now - map[key].t > 30) delete map[key]; });
      });
      while (K.list.length > 32 && K.list[K.list.length - 1] && now - K.list[K.list.length - 1].t > 30) K.list.pop();
    });
  }
  /** the memory one call uses → { s: its state (null until @openav/chop is here), dt: seconds since it was last used, now }
   *  · null: an unnamed call outside draw(). The places are kept from the first frame, module or not. */
  function slotOf(kind, name, make) {
    var K = chopKinds[kind] || (chopKinds[kind] = { list: [], site: null, named: {}, i: 0, prev: -1, occ: {} });
    var drawing = inDraw(), now = drawing ? chopTick() : clock() / 1000, s, M = chopMod();
    if (name != null) {
      s = K.named[name] || (K.named[name] = { s: null, t: now });
    } else if (!drawing) {
      hint('chopOut:' + kind, 'chopOutside', { fn: kind, example: CHOP_EX[kind] || CHOP_EX.lag }, 'info');
      return null;
    } else {
      var i = K.i++;
      if (K.site) {
        var at = callSite(), key = at + '#' + (K.occ[at] = (K.occ[at] || 0) + 1);
        s = K.site[key] || (K.site[key] = { s: null, t: now, at: at });
      } else {
        s = K.list[i] || (K.list[i] = { s: null, t: now, at: callSite(), born: cf.n });
        if (s.stepN !== cf.n) { s.undo = s.s ? { st: chopSnap(s.s), t: s.t } : null; s.stepN = cf.n; }
      }
    }
    if (!s.s && M) s.s = make(M);                       // its first step takes the input as it is: nothing glides in from 0
    s.dt = Math.max(0, now - s.t); s.t = now; s.now = now;
    return s;
  }
  // a string at the end names the slot; so does anything given in the name's own place (lag's 4th: 'p' + i, or a number)
  function chopName(args, pos) {
    var n = args.length, last = args[n - 1];
    if (n > 1 && typeof last === 'string') return last;
    return n > pos && args[pos] != null ? args[pos] : null;
  }
  function chopNum(v, d) { return typeof v === 'number' && isFinite(v) ? v : d; }
  var CHOP_EX = { lag: "lag(knob1, 0.1, 0.5, 'a')", spring: "spring(knob1, 100, 6, 'a')", speed: "speed(micLevel, 'a')", trail: "trail(micLevel, 2, 'a')",
    slope: "slope(knob1, 'a')", count: "count(beat, 4, 'a')", env: "env(mouseIsPressed, 0.01, 0.3, 'a')", drawTrail: "drawTrail(micLevel, 0, 0, width, 100, 0, 1, 'a')", scope: "scope(micLevel, 'mic')" };

  // -- events: what env('kick') and count('kick') hear. The microphone's hits and the drum machine's (the same names
  //    kickDetected() hears), any key, the machine's bars and steps, its cues by name, and trigger('anything').
  var evTimes = {}, evCount = {}, evOff = {}, evBeatAt = -1;
  var EV_HITS = { kick: 1, snare: 1, hat: 1, beat: 1 }, EV_BUILTIN = { kick: 1, snare: 1, hat: 1, beat: 1, note: 1, bar: 1, step: 1 };
  function evPush(name) {
    var a = evTimes[name] || (evTimes[name] = []);
    a.push(clock() / 1000);
    if (a.length > 32) a.splice(0, a.length - 32);
    evCount[name] = (evCount[name] || 0) + 1;
  }
  function evDrums() {                                 // subscribed once: drums.on() is what drumHit() hears (no new UI, nothing loads)
    if (evOff.drums) return;
    evOff.drums = [
      drums.on('hit', function (lane) {
        var cb = DRUM_CB[lane];
        if (cb) evPush(cb.replace('Detected', ''));    // kickDetected → 'kick': the lanes the sketch's own callbacks hear
        if (DRUM_BEAT[lane] && drums.count !== evBeatAt) { evBeatAt = drums.count; evPush('beat'); }   // one beat per step, as beatDetected
      }),
      drums.on('bar', function () { evPush('bar'); }),
      drums.on('step', function () { evPush('step'); }),
      drums.on('cue', function (name) { evPush(String(name)); }),
    ];
  }
  function evListen(name) {
    evDrums();
    if (EV_HITS[name]) {
      if (!evOff['mic:' + name]) evOff['mic:' + name] = mic.on(name, function () { evPush(name); });
      if (!drumsWanted && !drums.machine) micNeeded('env');   // no drums asked for: the hits are the microphone's (as a read of micLevel)
    } else if (name === 'note') {
      if (!evOff.note) evOff.note = midi.on('noteOn', function () { evPush('note'); });
    } else if (!EV_BUILTIN[name] && !evOff['wait:' + name]) {   // a name of the sketch's own: say so if nothing ever triggers it
      evOff['wait:' + name] = true;
      var tm = setTimeout(function () { if (!evCount[name]) hint('chopEvent:' + name, 'chopNoEvent', { name: name }, 'info'); }, 4000);
      if (tm && tm.unref) tm.unref();                  // (Node, in the tests: never what keeps it running)
    }
  }
  function evNow() { return inDraw() ? chopTick() : clock() / 1000; }

  /** lag(value, up, down, name): follows value, up seconds while it rises, down while it falls (down = up when left out) */
  FUNCS.lag = function (value, up, down) {
    if (typeof value === 'boolean') value = +value;   // lag(kickIsDetected, 0, 0.3): true is 1
    var name = chopName(arguments, 3), u = Math.max(0, chopNum(up, 0.1)), d = Math.max(0, chopNum(down, u));
    var s = slotOf('lag', name, function (M) { return new M.Lag({ up: u, down: d }); });
    return s && s.s ? s.s.step(value, s.dt, u, d) : value;
  };
  /** env('kick', attack, decay): 1 right after each kick (attack seconds to get there), 0 again after decay seconds.
   *  env(mouseIsPressed, …): the same on every press (a boolean, or a number above 0.5, turning on) */
  FUNCS.env = function (event, attack, decay) {
    var a = Math.max(0, chopNum(attack, 0.01)), d = Math.max(0, chopNum(decay, 0.3));
    if (event == null || typeof event === 'string') {
      var name = event == null ? 'beat' : event;
      evListen(name);
      var M = chopMod(), times = evTimes[name];
      return M && times ? M.envelope(times, evNow(), a, d) : 0;
    }
    var s = slotOf('env', chopName(arguments, 3), function () { return { on: false, times: [], value: 0 }; });
    if (!s || !s.s) return 0;
    var on = event === true || (typeof event === 'number' && event > 0.5);
    if (on && !s.s.on) { s.s.times.push(s.now); if (s.s.times.length > 32) s.s.times.shift(); }
    s.s.on = on;
    return (s.s.value = chop.module.envelope(s.s.times, s.now, a, d));
  };
  /** trigger('boom'): an event of the sketch's own, for env('boom') and count('boom') */
  FUNCS.trigger = function (name) { evPush(name == null ? 'trigger' : String(name)); };
  /** speed(rate, name): adds rate every second → rotate(speed(TWO_PI)) is one turn a second */
  FUNCS.speed = function (rate) {
    var s = slotOf('speed', chopName(arguments, 1), function (M) { return new M.Speed(); });
    return s && s.s ? s.s.step(rate, Math.min(s.dt, 0.25)) : 0;   // a frame counts 0.25 s at most: back from a hidden tab, no leap
  };
  /** spring(value, stiffness, damping, name): follows value like a mass on a spring (overshoots, settles) */
  FUNCS.spring = function (value, stiffness, damping) {
    var k = Math.max(0, chopNum(stiffness, 100)), c = Math.max(0, chopNum(damping, 6));
    var s = slotOf('spring', chopName(arguments, 3), function (M) { return new M.Spring({ stiffness: k, damping: c }); });
    return s && s.s ? s.s.step(value, s.dt, k, c) : value;
  };
  /** trail(value, seconds, name): the last seconds (2) of value, 60 a second, oldest first, the newest last */
  function trailOf(kind, value, seconds, name) {
    var sec = Math.max(0.05, Math.min(600, chopNum(seconds, 2)));
    var s = slotOf(kind, name, function (M) { return new M.Trail({ seconds: sec }); });
    return s && s.s ? s.s.step(value, s.dt, sec) : [];
  }
  FUNCS.trail = function (value, seconds) { return trailOf('trail', value, seconds, chopName(arguments, 2)); };
  /** slope(value, name): how fast value changes, per second */
  FUNCS.slope = function (value) {
    var s = slotOf('slope', chopName(arguments, 1), function (M) { return new M.Slope(); });
    return s && s.s ? s.s.step(value, s.dt) : 0;
  };
  /** count(beat): how many times it turned on · count(beat, 4): 0 1 2 3 0 … · count('kick'): how many kicks so far */
  FUNCS.count = function (on, limit) {
    var M = chopMod(), lim = chopNum(limit, 0);
    if (typeof on === 'string') { evListen(on); return M ? M.wrapCount(evCount[on] || 0, lim) : 0; }
    var s = slotOf('count', chopName(arguments, 2), function (M2) { return new M2.Count(); });
    if (!s || !s.s) return 0;
    s.s.value = s.s.step(on, lim);
    return s.s.value;
  };

  // -- scope(value, label): a small oscilloscope in the corner across from the 🎹, the last few seconds of each value the frame
  //    passed to it, one line per label. DOM over the page (pointer-events: none), so it is never in a recording or a 📷, and
  //    never takes a click from the sketch. hints=off or scope=off: none (scope() still returns its value).
  var SCOPE_ON = HINTS_ON && opt('scope', 'on') !== 'off', SCOPE_SECONDS = 4;
  var SCOPE_COLORS = ['#5fe08a', '#ffd36b', '#9fd8ff', '#ff7ab6', '#ff9a5c', '#c3a6ff'];
  var scopeBox = null, scopeCv = null, scopeRun = false, scopeSeen = -1e9, scopeOrder = 0, scopeTick = 0;
  FUNCS.scope = function (value, label) {
    var x = typeof value === 'boolean' ? +value : value;
    if (!SCOPE_ON || !doc || typeof x !== 'number' || !isFinite(x) || !inDraw()) return value;
    var s = slotOf('scope', label != null ? String(label) : null, function (M) { return { trail: new M.Trail({ seconds: SCOPE_SECONDS }), order: ++scopeOrder, label: label != null ? String(label) : '' }; });
    if (!s || !s.s) return value;
    s.s.trail.step(x, s.dt); s.s.value = x; s.s.seen = s.now;
    scopeSeen = clock();
    if (!scopeRun) { scopeRun = true; raf(scopePaint); }
    return value;
  };
  function scopeChannels() {
    var K = chopKinds.scope, out = [], now = clock() / 1000;
    if (!K) return out;
    var add = function (s) { if (s && s.s && now - s.s.seen < 1) out.push(s.s); };
    K.list.forEach(add);
    if (K.site) Object.keys(K.site).forEach(function (k) { add(K.site[k]); });
    Object.keys(K.named).forEach(function (k) { add(K.named[k]); });
    return out.sort(function (a, b) { return a.order - b.order; });
  }
  function placeScope() {
    var side = O.corner === 'right' ? 'left' : 'right', edge = O.dock, off = 10;
    if (panelOpen && dock) off += dock.getBoundingClientRect().height;
    if (edge === 'top' && side === 'right' && onOP) off += 46;   // OpenProcessing: OPC's icon sits top-right
    if (edge === 'top' && drumCard && drumCard.offsetParent) {   // the drum grid, top centre: keep below it where they would meet
      var d = drumCard.getBoundingClientRect(), b = scopeBox.getBoundingClientRect();
      if (d.left < b.right && d.right > b.left) off = Math.max(off, d.bottom + 8);
    }
    scopeBox.style[side] = '10px'; scopeBox.style[edge] = off + 'px';
  }
  function scopePaint() {
    if (clock() - scopeSeen > 1500 || !doc.body) { if (scopeBox) scopeBox.style.display = 'none'; scopeRun = false; return; }
    if (!scopeBox) {
      scopeBox = el('div', 'position:fixed;z-index:' + (Z - 3) + ';pointer-events:none;border-radius:10px;overflow:hidden;' +
        'background:rgba(14,14,18,.84);border:1px solid rgba(255,255,255,.18);box-shadow:0 6px 24px rgba(0,0,0,.3)');
      scopeBox.id = 'oav-p5-scope'; scopeBox.setAttribute('aria-hidden', 'true');
      scopeCv = el('canvas', 'display:block'); scopeBox.appendChild(scopeCv);
      doc.body.appendChild(scopeBox);
    }
    scopeBox.style.display = 'block';
    var ch = scopeChannels(), W = 264, rows = Math.max(1, Math.ceil(ch.length / 2)), top = 8 + rows * 16, PH = 84, H = top + PH + 18;
    var dpr = Math.min(3, g.devicePixelRatio || 1);
    if (scopeCv.width !== Math.round(W * dpr) || scopeCv.height !== Math.round(H * dpr)) {
      scopeCv.width = Math.round(W * dpr); scopeCv.height = Math.round(H * dpr); scopeCv.style.width = W + 'px'; scopeCv.style.height = H + 'px';
    }
    if (scopeTick++ % 15 === 0) placeScope();
    var c = scopeCv.getContext('2d');
    if (!c) { raf(scopePaint); return; }
    c.setTransform(dpr, 0, 0, dpr, 0, 0); c.clearRect(0, 0, W, H);
    var lo = 0, hi = 1;
    ch.forEach(function (s) { var v = s.trail.values(); for (var i = 0; i < v.length; i++) { if (v[i] < lo) lo = v[i]; if (v[i] > hi) hi = v[i]; } });
    c.font = '600 11px ui-monospace,Menlo,monospace'; c.textBaseline = 'middle';
    ch.forEach(function (s, i) {                       // the legend: two to a row, the label and the value now
      var x = 10 + (i % 2) * 126, y = 12 + Math.floor(i / 2) * 16, col = SCOPE_COLORS[(s.order - 1) % SCOPE_COLORS.length];
      c.fillStyle = col; c.fillRect(x, y - 1.5, 10, 3);
      var t = (s.label || String(s.order)); if (t.length > 9) t = t.slice(0, 8) + '…';
      c.fillText(t + ' ' + (Math.abs(s.value) >= 100 ? s.value.toFixed(0) : s.value.toFixed(2)), x + 14, y);
    });
    var x0 = 8, x1 = W - 34, y0 = top, y1 = top + PH, yOf = function (v) { return y1 - (v - lo) / (hi - lo || 1) * (y1 - y0); };
    c.strokeStyle = 'rgba(255,255,255,.16)'; c.lineWidth = 1; c.beginPath();
    [lo, hi].concat(lo < 0 && hi > 0 ? [0] : []).forEach(function (v) { var y = Math.round(yOf(v)) + 0.5; c.moveTo(x0, y); c.lineTo(x1, y); });
    c.stroke();
    c.fillStyle = 'rgba(255,255,255,.55)'; c.font = '500 10px ui-monospace,Menlo,monospace';
    var lbl = function (v) { return Math.abs(v) >= 100 ? v.toFixed(0) : String(+v.toFixed(2)); };
    c.fillText(lbl(hi), x1 + 4, y0); c.fillText(lbl(lo), x1 + 4, y1); c.fillText('−' + SCOPE_SECONDS + ' s', x0, y1 + 10);
    ch.forEach(function (s) {
      var v = s.trail.values(), n = v.length;
      if (n < 2) return;
      c.strokeStyle = SCOPE_COLORS[(s.order - 1) % SCOPE_COLORS.length]; c.lineWidth = 1.6; c.lineJoin = 'round'; c.beginPath();
      for (var i = 0; i < n; i++) { var px = x0 + (x1 - x0) * i / (n - 1), py = yOf(v[i]); if (i) c.lineTo(px, py); else c.moveTo(px, py); }
      c.stroke();
    });
    raf(scopePaint);
  }
  // -- drawTrail(values, x, y, w, h, lo, hi): the same picture ON the canvas (so it is in the work, and in a recording): a line
  //    through the values, the oldest at x, lo at the bottom and hi at the top (0 and 1). A number instead of an array keeps its
  //    own trail of the last 2 s. The sketch's stroke(); with noStroke() in effect, white.
  function strokeOff() {
    try { var r = p5inst() && p5inst()._renderer; if (!r) return false; if (r._doStroke === false) return true; if (r.states && 'strokeColor' in r.states && !r.states.strokeColor) return true; } catch (e) { /* */ }
    return false;
  }
  FUNCS.drawTrail = function (values, x, y, w, h, lo, hi) {
    var a = values;
    if (!a || typeof a !== 'object' || typeof a.length !== 'number') a = trailOf('drawTrail', values, 2, chopName(arguments, 7));
    if (typeof g.beginShape !== 'function' || a.length < 2) return a;
    x = chopNum(x, 0); y = chopNum(y, 0); w = chopNum(w, chopNum(g.width, 100)); h = chopNum(h, chopNum(g.height, 100));
    lo = chopNum(lo, 0); hi = chopNum(hi, 1);
    var n = a.length;
    g.push(); g.noFill();
    if (strokeOff()) g.stroke(255);
    g.beginShape();
    for (var i = 0; i < n; i++) {
      var v = typeof a[i] === 'boolean' ? +a[i] : a[i];
      if (typeof v !== 'number' || !isFinite(v)) continue;
      var u = hi === lo ? 0.5 : (v - lo) / (hi - lo);
      g.vertex(x + w * i / (n - 1), y + h - (u < 0 ? 0 : u > 1 ? 1 : u) * h);
    }
    g.endShape(); g.pop();
    return a;
  };
  CHOP_FNS.forEach(function (k) { chop[k] = FUNCS[k]; });   // OAVp5.chop.speed(…): for a sketch whose own `speed` is a number
  var HC = zh ? {
    chopOrder: ['{fn}() 每一幀呼叫的次數變了', '上一幀 {m} 次、這一幀 {n} 次。沒有名字的 {fn}() 照呼叫的先後找回自己上一幀的值，次數一變先後就對不上；從現在起改成照「寫在哪一行」對應（同一行照先後）。', '放在 if 或迴圈裡、時有時無的，給它一個名字最穩：{example}'],
    chopOutside: ['{fn}() 在 draw() 外面被呼叫', '沒有名字的 {fn}() 靠 draw() 每一幀的呼叫順序記住上一幀；在 setup()、mousePressed() 這類地方它不記東西，直接回傳原值。', '移到 draw() 裡；或給它一個名字，在哪裡呼叫都是同一個：{example}'],
    chopNoEvent: ["env('{name}') 一直沒有動", '沒有東西觸發「{name}」。內建的事件：kick、snare、hat、beat（麥克風或鼓機）、note（任何琴鍵）、bar、step（鼓機）；其他名字要自己觸發。', "檢查拼字；或在 mousePressed() 這類地方寫 trigger('{name}')。"],
  } : {
    chopOrder: ['{fn}() was called a different number of times this frame', '{m} times in the last frame, {n} in this one. An unnamed {fn}() finds its memory by the order of the calls, and the order no longer lines up; from now on each call is matched by the line it is written on (in order on one line).', 'For one inside an if, or in a loop that grows and shrinks, a name is the sure way: {example}'],
    chopOutside: ['{fn}() was called outside draw()', 'An unnamed {fn}() remembers the last frame by its place among the calls in draw(); in setup(), mousePressed() and the like it remembers nothing and returns its input as it is.', 'Move it into draw(), or give it a name and it is the same one wherever it is called: {example}'],
    chopNoEvent: ["env('{name}') never moves", 'Nothing triggers "{name}". Built in: kick, snare, hat, beat (microphone or drums), note (any key), bar, step (drums); any other name is the sketch\'s own.', "Check the spelling, or call trigger('{name}') somewhere, e.g. in mousePressed()."],
  };
  Object.keys(HC).forEach(function (k) { H[k] = HC[k]; });

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
  for (var ri = 1; ri <= 16; ri++) { if (ri <= 8) { ctlName('knob', ri); ctlName('fader', ri); } ctlName('pad', ri); }
  Object.keys(FUNCS).forEach(function (k) { if (typeof g[k] === 'undefined') setGlobal(k, FUNCS[k]); else yielded.push(k); });
  // In Strudel the names that stepped aside are Strudel's own functions (note, velocity, beat), not a sketch's variables:
  // one card says which, and what to read instead, at once (in a sketch the card comes the first time one is written)
  if (onStrudel && yielded.length) {
    var alts = yielded.filter(function (k) { return STRUDEL_ALT[k]; }).map(function (k) { return k + ' → ' + STRUDEL_ALT[k]; });
    hint('strudelNames', null, { names: yielded.join(zh ? '、' : ', '), alts: alts.length ? alts.join(zh ? '；' : '; ') : 'OAVp5.…' }, 'info', { ttl: 15000 });
  }
  if (O.link) startLink();

  if (O.hardware === 'auto') connectHardware();
  if (g.addEventListener) g.addEventListener('load', function () { setTimeout(midiTrouble, 0); });
  var atBody = function () { placeButton(); flushHints(); };
  if (doc) { if (doc.body) atBody(); else doc.addEventListener('DOMContentLoaded', atBody); }
  // ?oav_sound=piano (OpenProcessing: ?sketch_oav_sound=piano): any sketch is heard, from the first click, with no code
  if (O.sound !== 'click' && O.sound !== 'off') startSound(O.sound === 'on' || O.sound === 'auto' ? null : O.sound);
})();
