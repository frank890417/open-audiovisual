// oav-p5.js without a browser: one parser for every source, the state a sketch reads, the callbacks it defines.
// (The browser half — p5 1.x/2.x, the 🎹 panel, the shim, a phone over a relay — is p5/test/smoke.cjs.)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const SRC = readFileSync(new URL('../p5/oav-p5.js', import.meta.url), 'utf8');

/** a fresh "page": no document, no Web MIDI (Safari-like), whatever globals the sketch defines */
function page(globals = {}) {
  const win = { console: { info() {}, warn() {}, error() {} }, navigator: {}, location: { search: '' }, URL, URLSearchParams, Promise, setTimeout, clearTimeout, setInterval, clearInterval, ...globals };
  win.window = win; win.globalThis = win;
  vm.runInNewContext(SRC, win);
  return win;
}

test('a key: midi.note, midi.held, noteOn / noteOff with velocity 0..1 and the channel', () => {
  const calls = [];
  const w = page({ noteOn: (n, v, ch) => calls.push(['on', n, v, ch]), noteOff: (n, ch) => calls.push(['off', n, ch]) });
  w.midi.input([0x90, 60, 127], 'hardware');
  w.midi.input([0x91, 48, 64], 'hardware');
  assert.equal(w.midi.note[60], 1);
  assert.deepEqual([...w.midi.held], [48, 60]);   // copied: the vm realm has its own Array
  w.midi.input([0x80, 60, 0], 'hardware');
  w.midi.input([0x91, 48, 0], 'hardware');               // note-on with velocity 0 is a release
  assert.equal(w.midi.note[60], 0);
  assert.deepEqual([...w.midi.held], []);
  assert.deepEqual(calls, [['on', 60, 1, 1], ['on', 48, 64 / 127, 2], ['off', 60, 1], ['off', 48, 2]]);
});

test('a knob and the bend: midi.cc 0..1, midi.bend −1..1, controlChange', () => {
  const got = [];
  const w = page({ controlChange: (cc, v) => got.push([cc, v]) });
  w.midi.input([0xB0, 74, 127]);
  w.midi.input([0xB0, 1, 0]);
  w.midi.input([0xE0, 0x7F, 0x7F]);
  assert.equal(w.midi.cc[74], 1);
  assert.equal(w.midi.cc[1], 0);
  assert.deepEqual(got, [[74, 1], [1, 0]]);
  assert.equal(w.midi.bend, 1);
  w.midi.input([0xE0, 0, 0x40]);
  assert.equal(w.midi.bend, 0);
  w.midi.input([0xE0, 0, 0]);
  assert.equal(w.midi.bend, -1);
});

test('clock, sysex and stray data bytes never reach the sketch', () => {
  const seen = [];
  const w = page({ midiMessage: (b) => seen.push(b) });
  w.midi.input([0xF8]); w.midi.input([0xF0, 1, 2]); w.midi.input([60, 100]); w.midi.input([]);
  assert.equal(seen.length, 0);
});

test('every source is the same bytes: last.source tells them apart, nothing else does', () => {
  const w = page();
  for (const s of ['hardware', 'screen', 'phone']) {
    w.midi.input([0x90, 62, 100], s);
    assert.equal(w.midi.last.source, s);
    assert.equal(w.midi.note[62], 100 / 127);
    w.midi.input([0x80, 62, 0], s);
  }
  w.midi.play(64, 0.5);
  assert.equal(w.midi.last.source, 'screen');
  assert.equal(w.midi.note[64], Math.round(0.5 * 127) / 127);
});

test('midi.on: several listeners, unknown names refused, off() works', () => {
  const w = page();
  const a = [], b = [];
  const off = w.midi.on('noteOn', (n) => a.push(n));
  w.midi.on('noteon', (n) => b.push(n));                 // the lower-case spelling WebMidi.js users type
  assert.throws(() => w.midi.on('nope', () => {}), /unknown event/);
  w.midi.input([0x90, 1, 1]); off(); w.midi.input([0x90, 2, 1]);
  assert.deepEqual(a, [1]);
  assert.deepEqual(b, [1, 2]);
});

test('an error inside the sketch callback does not stop the next message', () => {
  let n = 0;
  const w = page({ noteOn: () => { n++; throw new Error('student bug'); } });
  w.midi.input([0x90, 60, 1]); w.midi.input([0x90, 61, 1]);
  assert.equal(n, 2);
  assert.equal(w.midi.note[61], 1 / 127);
});

test('no Web MIDI here (Safari): hardware says unavailable instead of throwing', async () => {
  const w = page();
  assert.equal(await w.midi.connectHardware(), false);
  assert.equal(w.midi.hardware, 'unavailable');
});

test('loaded twice (the first line and the Custom Library): the first copy stays', () => {
  const w = page();
  const first = w.OAVp5;
  vm.runInNewContext(SRC, w);
  assert.equal(w.OAVp5, first);
  assert.equal(w.midi, first);
});

test('a page that already has its own `midi` keeps it', () => {
  const mine = { mine: true };
  const w = page({ midi: mine });
  assert.equal(w.midi, mine);
  assert.equal(typeof w.OAVp5.note, 'object');
});

// ---------------------------------------------------------------- v0.2: the p5-style names, devices, OPC

const json = (f) => JSON.parse(readFileSync(new URL(`../packages/midi/profiles/${f}`, import.meta.url), 'utf8'));
const plain = (o) => JSON.parse(JSON.stringify(o));          // out of the vm realm before deepEqual

test('the built-in MiniLab 3 and LPD8 tables are exactly what their profiles say', () => {
  const w = page();
  const [ml3, lpd8] = w.OAVp5._builtin;
  assert.deepEqual(plain(w.OAVp5._tableOf(ml3)), plain(w.OAVp5._tableOf(json('arturia-minilab3.json'))));
  assert.deepEqual(plain(w.OAVp5._tableOf(lpd8)), plain(w.OAVp5._tableOf(json('akai-lpd8.json'))));
});

test('knob1 is knob 1 on whichever controller played: MiniLab 3 CC 74, LPD8 CC 70', () => {
  const moved = [];
  const w = page({ knobMoved: (n, v) => moved.push([n, v]) });
  assert.equal(w.knob1, 0);
  w.midi.input([0xB0, 74, 127]);                              // the on-screen MiniLab 3 (default)
  assert.equal(w.knob1, 1);
  w.midi.input([0xB0, 70, 0], 'hardware', 'akai-lpd8');       // an LPD8: CC 70 is its K1
  assert.equal(w.knob1, 0);
  w.midi.input([0xB0, 74, 127], 'hardware', 'akai-lpd8');     // CC 74 on an LPD8 is K5, not knob 1
  assert.equal(w.knob5, 1);
  assert.equal(w.knob(5), 1);
  w.midi.input([0xB0, 82, 127]);                              // MiniLab 3 fader S1
  assert.equal(w.fader1, 1);
  assert.deepEqual(moved, [[1, 1], [1, 0], [5, 1]]);
  assert.equal(w.midi.last.control, 'fader1');
});

test('keys: notePressed / noteReleased, note, velocity, noteIsPressed, noteIsDown', () => {
  const log = [];
  const w = page({ notePressed: (n, v) => log.push(['p', n, v]), noteReleased: (n) => log.push(['r', n]) });
  w.midi.input([0x90, 60, 127]);
  assert.equal(w.note, 60); assert.equal(w.velocity, 1); assert.equal(w.noteIsPressed, true); assert.equal(w.noteIsDown(60), true);
  w.midi.input([0x80, 60, 0]);
  assert.equal(w.noteIsPressed, false); assert.equal(w.noteIsDown(60), false);
  assert.deepEqual(log, [['p', 60, 1], ['r', 60]]);
});

test('pads: pad1 + padPressed; a pad calls notePressed only when the sketch has no padPressed', () => {
  const a = [];
  const w1 = page({ notePressed: (n) => a.push(n) });
  w1.midi.input([0x99, 36, 127]);                             // MiniLab 3 pad 1 (ch 10, note 36)
  assert.equal(w1.pad1, 1);
  assert.deepEqual(a, [36]);
  const b = [], c = [];
  const w2 = page({ notePressed: (n) => b.push(n), padPressed: (n, v) => c.push([n, v]), padReleased: (n) => c.push(['up', n]) });
  w2.midi.input([0x99, 37, 127]); w2.midi.input([0x89, 37, 0]);
  assert.deepEqual(b, []);
  assert.deepEqual(c, [[2, 1], ['up', 2]]);
  assert.equal(w2.pad2, 0);
});

test('a controller OAV does not know: the first knob turned is knob1, the next knob2', async () => {
  const w = page();
  w.midi.input([0xB0, 20, 64], 'hardware', 'Mystery Box');   // profiles start loading; this message has no number yet
  await new Promise((r) => setTimeout(r, 20));                // (in node the profile import fails ⇒ learn by order)
  w.midi.input([0xB0, 20, 127], 'hardware', 'Mystery Box');
  w.midi.input([0xB0, 9, 127], 'hardware', 'Mystery Box');
  assert.equal(w.knob1, 1); assert.equal(w.knob2, 1);
});

/** a stand-in for OP Configurator 3000: the same `options` shape and calls OpenProcessing's preview uses */
function fakeOPC() {
  const o = {
    options: {
      radius: { name: 'radius', type: 'slider', value: 10, min: 0, max: 100, step: 1 },
      speed: { name: 'speed', type: 'slider', value: 1, min: 0, max: 2, step: 0.1 },
      hasFill: { name: 'hasFill', type: 'toggle', value: false },
      boom: { name: 'boom', type: 'button', value: 'Boom' },
    },
    log: [],
    set(n, v) { o.options[n].value = v; o.log.push(['set', n, v]); },
    buttonPressed(n) { o.log.push(['down', n]); },
    buttonReleased(n) { o.log.push(['up', n]); },
  };
  return o;
}

test('OPC: knobs drive the sliders in order (scaled, on the step), pads flip toggles and press buttons', () => {
  const OPC = fakeOPC();
  const w = page({ OPC });
  w.midi.input([0xB0, 74, 64]);                               // knob 1 → radius 0..100, step 1
  w.midi.input([0xB0, 71, 127]);                              // knob 2 → speed 0..2
  w.midi.input([0x99, 36, 100]); w.midi.input([0x89, 36, 0]); // pad 1 → hasFill flips on press only
  w.midi.input([0x99, 37, 100]); w.midi.input([0x89, 37, 0]); // pad 2 → boom: pressed, released
  assert.equal(OPC.options.radius.value, 50);
  assert.equal(OPC.options.speed.value, 2);
  assert.equal(OPC.options.hasFill.value, true);
  assert.deepEqual(OPC.log.slice(-2), [['down', 'boom'], ['up', 'boom']]);
  assert.deepEqual(plain(w.midi.wiring()), [
    { control: 'knob1', name: 'radius' }, { control: 'knob2', name: 'speed' },
    { control: 'pad1', name: 'hasFill' }, { control: 'pad2', name: 'boom' }]);
});

test('OPC wiring can be turned off', () => {
  const OPC = fakeOPC();
  const w = page({ OPC, OAV_P5: { opc: 'off' } });
  w.midi.input([0xB0, 74, 127]);
  assert.equal(OPC.options.radius.value, 10);
  assert.equal(w.knob1, 1);
});

test('a sketch that has its own `note` or `velocity` keeps them', () => {
  const w = page({ velocity: 'mine' });                      // already there when the line ran
  w.midi.input([0x90, 62, 127]);
  assert.equal(w.velocity, 'mine');
  assert.equal(w.note, 62);
  w.note = 'also mine';                                       // assigned later by the sketch
  w.midi.input([0x90, 64, 127]);
  assert.equal(w.note, 'also mine');
  assert.equal(w.midi.last.note, 64);
});

test("on OpenProcessing, once its own OPC MIDI mapping is seen working, hardware is left to it (screen still wired)", () => {
  const OPC = fakeOPC();
  let onMessage = null;
  const w = page({ OPC, location: { search: '', hostname: 'preview.openprocessing.org' },
    addEventListener: (type, fn) => { if (type === 'message') onMessage = fn; } });
  assert.equal(typeof onMessage, 'function');
  w.midi.input([0xB0, 74, 127], 'hardware', 'arturia-minilab3');   // before: OAV drives radius
  assert.equal(OPC.options.radius.value, 100);
  // OpenProcessing's panel answers that knob with its own mapping right away
  onMessage({ data: { messageType: 'OPC_update', message: JSON.stringify({ name: 'speed', value: 1.5 }) } });
  w.midi.input([0xB0, 74, 0], 'hardware', 'arturia-minilab3');
  assert.equal(OPC.options.radius.value, 100);                      // hardware: left alone now
  w.midi.input([0xB0, 74, 0]);                                      // the on-screen controller: still wired
  assert.equal(OPC.options.radius.value, 0);
  assert.equal(w.knob1, 0);                                         // the p5-style name still follows it (read last: a read takes knob 1 from OPC)
});

test('an OPC_update with no hardware just before (someone dragging the panel) changes nothing', () => {
  const OPC = fakeOPC();
  let onMessage = null;
  const w = page({ OPC, location: { search: '', hostname: 'preview.openprocessing.org' },
    addEventListener: (type, fn) => { if (type === 'message') onMessage = fn; } });
  onMessage({ data: { messageType: 'OPC_update', message: '{}' } });
  w.midi.input([0xB0, 74, 127], 'hardware', 'arturia-minilab3');
  assert.equal(OPC.options.radius.value, 100);
});

// ---------------------------------------------------------------- example 15: the line, shown on a page

const ONE_LINE = "document.head.prepend(Object.assign(document.createElement('script'), { src: 'https://openaudiovisual.com/p5/oav-p5.js' }));";
const EX15 = (f) => new URL(`../examples/15-p5-one-line/${f}`, import.meta.url);

test('example 15: the sketch file starts with the one line, and the README shows the very same line', () => {
  const sketch = readFileSync(EX15('sketch.js'), 'utf8');
  assert.equal(sketch.split('\n')[0], ONE_LINE);
  assert.ok(readFileSync(new URL('../p5/README.md', import.meta.url), 'utf8').includes(ONE_LINE));
});

test('example 15: the page runs that sketch file (last script, p5 from the CDN, no framework) and the source panel reads the same file', () => {
  const html = readFileSync(EX15('index.html'), 'utf8');
  const scripts = [...html.matchAll(/<script\b([^>]*)>/g)].map((m) => m[1]);
  assert.match(scripts[scripts.length - 1], /src="\.\/sketch\.js(\?v=[^"]*)?"/, 'sketch.js is the last <script>: p5 reads the last script as the sketch (stamp-version may add ?v=)');
  assert.ok(scripts.some((a) => /src="https:\/\/cdn\.jsdelivr\.net\/npm\/p5@1\.11\.\d+\/lib\/p5\.min\.js"/.test(a)), 'p5 1.11.x from the CDN');
  assert.ok(!/importmap|createShow|@openav\//.test(html), 'the point is the one line: no import map, no createShow');
  assert.ok(!html.includes("document.head.prepend"), 'the line is not copied into the page: it is read from sketch.js');
  assert.match(html, /fetch\(\s*['"]\.\/sketch\.js['"]/, 'the source panel fetches ./sketch.js');
  assert.equal([...html.matchAll(/sketch\.js/g)].length >= 2, true);
  assert.match(html, /<title>p5\.js in one line · open-audiovisual example<\/title>/);   // the head region of tools/build-examples.mjs
  assert.match(html, /<meta name="description"/);
  assert.match(html, /openaudiovisual\.com\/docs\/#p5/);
  assert.match(html, /openaudiovisual\.com\/zh\/docs\/#p5/);
});

test('example 15: the sketch uses the p5-style names the page promises, and the thumbnail exists', () => {
  const s = readFileSync(EX15('sketch.js'), 'utf8');
  for (const name of ['knob1', 'knob2', 'knob3', 'knob4', 'notePressed', 'noteReleased', 'noteIsDown', 'padPressed']) assert.ok(s.includes(name), name);
  assert.ok(/pad\(/.test(s) || /pad1/.test(s));
  const webp = readFileSync(new URL('../assets/home/works/15.webp', import.meta.url));
  assert.ok(webp.length > 1000 && webp.length <= 120 * 1024, `15.webp is ${webp.length} bytes`);
  assert.equal(webp.subarray(0, 4).toString(), 'RIFF');
  assert.equal(webp.subarray(8, 12).toString(), 'WEBP');
});

// ---------------------------------------------------------------- the microphone (0.3.0)
// Browser half (fake microphone, p5 1.x and 2.x, p5.sound next to it): p5/test/mic-smoke.cjs.
function micPage(globals = {}) {
  const asked = { getUserMedia: 0 };
  const navigator = { mediaDevices: { getUserMedia() { asked.getUserMedia++; return Promise.reject(Object.assign(new Error('no'), { name: 'NotAllowedError' })); } } };
  const w = page({ navigator, ...globals });
  return { w, asked };
}
const FEAT = (o = {}) => ({ rms: 0.1, peak: 0.3, low: 0.5, mid: 0.25, high: 0.125, centroid: 0.2, onset: false,
  kick: { hit: false, level: 0, env: 0 }, snare: { hit: false, level: 0, env: 0 }, hat: { hit: false, level: 0, env: 0 }, ...o });

test('mic: the page loads without touching the microphone; the names are there but quiet until read', () => {
  const { w, asked } = micPage();
  assert.equal(w.OAVp5.mic.state, 'off');
  assert.equal(asked.getUserMedia, 0);
  assert.equal(typeof w.startMic, 'function');
  assert.equal(typeof w.stopMic, 'function');
  assert.equal(w.micIsOn, false);
  for (const n of ['micLevel', 'bass', 'mid', 'treble', 'beat']) {
    const d = Object.getOwnPropertyDescriptor(w, n);
    assert.ok(d && typeof d.get === 'function', n + ' is a reader, not a value');
    assert.equal(d.enumerable, false, n + ' is not listed when the page lists its globals');
  }
  assert.equal(w.OAVp5.mic.state, 'off', 'looking at the descriptors read nothing');
});

test('mic: the first read starts it (and returns 0); the options click and off never do', () => {
  const a = micPage();
  assert.equal(a.w.micLevel, 0);
  assert.equal(a.w.OAVp5.mic.state, 'asking');
  assert.equal(a.w.bass + a.w.mid + a.w.treble, 0);
  for (const mic of ['click', 'off']) {
    const b = micPage({ OAV_P5: { mic } });
    assert.equal(b.w.micLevel, 0);
    assert.equal(b.w.OAVp5.mic.state, 'off', 'mic=' + mic);
  }
  const o = micPage({ OAV_P5: { mic: 'off' } });
  o.w.startMic();
  assert.equal(o.w.OAVp5.mic.state, 'off', 'mic=off: not even startMic() opens it');
  const c = micPage({ OAV_P5: { mic: 'click' } });
  c.w.startMic();
  assert.equal(c.w.OAVp5.mic.state, 'asking', 'startMic() works whatever the option');
});

test('mic: a browser with no getUserMedia (http, old) says "unavailable" and the reads stay 0', () => {
  const w = page();
  assert.equal(w.micLevel, 0);
  assert.equal(w.OAVp5.mic.state, 'unavailable');
  assert.equal(w.bass, 0);
});

test('mic: features become micLevel / bass / mid / treble, 0..1, and the gain scales them', () => {
  const { w } = micPage({ OAV_P5: { mic: 'click' } });
  const m = w.OAVp5.mic;
  m._frame(FEAT());
  assert.ok(w.micLevel > 0 && w.micLevel <= 1, 'micLevel ' + w.micLevel);
  assert.equal(w.bass, 0.5); assert.equal(w.mid, 0.25); assert.equal(w.treble, 0.125);
  m._frame(FEAT({ rms: 0 })); assert.equal(w.micLevel, 0);
  m._frame(FEAT({ rms: 1, low: 1 })); assert.equal(w.micLevel, 1);
  m.gain = 4; m._frame(FEAT()); assert.equal(w.bass, 1); assert.equal(w.mid, 1); assert.equal(w.treble, 0.5);
});

test('mic: beatDetected(level), kickDetected, snareDetected, hatDetected are called like notePressed; mic.on() hears them too', () => {
  const calls = [];
  const { w } = micPage({ OAV_P5: { mic: 'click' }, beatDetected: (l) => calls.push(['beat', l]), kickDetected: (l) => calls.push(['kick', l]),
    snareDetected: () => calls.push(['snare']), hatDetected: () => { throw new Error('boom'); } });
  const heard = []; const off = w.OAVp5.mic.on('beat', (l) => heard.push(l));
  w.OAVp5.mic._frame(FEAT({ onset: true, kick: { hit: true, level: 0.6, env: 0.6 }, snare: { hit: true, level: 0.4, env: 0.4 }, hat: { hit: true, level: 0.2, env: 0.2 } }));
  assert.deepEqual(calls.map((c) => c[0]), ['beat', 'kick', 'snare']);
  assert.ok(calls[0][1] > 0 && calls[0][1] <= 1);
  assert.equal(calls[1][1], 0.6);
  assert.equal(heard.length, 1);
  off(); w.OAVp5.mic._frame(FEAT({ onset: true })); assert.equal(heard.length, 1);
  assert.throws(() => w.OAVp5.mic.on('nope', () => {}), /unknown mic event/);
});

test('mic: `beat` is true for exactly one p5 frame per beat, however often it is read', () => {
  const { w } = micPage({ OAV_P5: { mic: 'click' }, frameCount: 1 });
  const m = w.OAVp5.mic;
  assert.equal(w.beat, false);
  m._frame(FEAT({ onset: true }));
  w.frameCount = 2;
  assert.equal(w.beat, true); assert.equal(w.beat, true, 'same frame, same answer');
  w.frameCount = 3; assert.equal(w.beat, false);
  m._frame(FEAT({ onset: true })); m._frame(FEAT({ onset: true }));   // two beats between two frames count as one frame
  w.frameCount = 4; assert.equal(w.beat, true);
  w.frameCount = 5; assert.equal(w.beat, false);
});

test('mic: a name the sketch already has is left alone (and reading it never starts the microphone)', () => {
  const { w, asked } = micPage({ bass: 7 });
  assert.equal(w.bass, 7);
  assert.equal(w.OAVp5.mic.state, 'off');
  // a sketch that assigns the name later keeps its own value, and never wakes the microphone
  const b = micPage();
  b.w.treble = 3;
  assert.equal(b.w.treble, 3);
  assert.equal(b.w.OAVp5.mic.state, 'off');
  assert.equal(asked.getUserMedia + b.asked.getUserMedia, 0);
});

test('mic: nothing here collides with the names p5 and p5.sound own', () => {
  // the names this file adds to the page for the microphone; the browser half checks them against p5 1.11.11, 2.0.5, 2.3.4
  // and p5.sound 1.x / 0.4.1; these are the ones by hand
  const ours = ['micLevel', 'micIsOn', 'startMic', 'stopMic', 'micSensitivity', 'bass', 'mid', 'treble', 'beat', 'beatDetected', 'kickDetected', 'snareDetected', 'hatDetected'];
  const p5sound = ['getAudioContext', 'userStartAudio', 'getOutputVolume', 'outputVolume', 'soundFormats', 'loadSound', 'createConvolver', 'getLevel', 'AudioIn', 'FFT', 'Amplitude', 'masterVolume', 'sampleRate', 'freqToMidi', 'midiToFreq', 'noteToFreq'];
  for (const n of ours) assert.ok(!p5sound.includes(n), n);
});

// ---------------------------------------------------------------- sound, the drum machine, cues (0.4.0)
// Browser half (p5 1.11.11 and 2.x, a stubbed and a real Tone.js, the grid on screen): p5/test/kit-smoke.cjs.
const NEW_NAMES = ['startSound', 'stopSound', 'soundIsOn', 'startDrums', 'stopDrums', 'drumsAreOn', 'drumStep', 'drumBar', 'drumBpm', 'cue', 'cueName'];
const NEW_CALLBACKS = ['drumHit', 'barStarted', 'stepStarted', 'cueFired'];

/** a page whose gesture listeners we can fire, whose lazy modules come from a map instead of the network */
function kitPage(globals = {}, modules = {}) {
  const listeners = {};
  const w = page({ addEventListener: (type, fn) => { (listeners[type] = listeners[type] || []).push(fn); }, ...globals });
  const loaded = [];
  w.OAVp5._import = (url) => {
    loaded.push(url);
    const key = Object.keys(modules).find((k) => url.includes(k));
    return key ? Promise.resolve(modules[key]()) : Promise.reject(new Error('not in this test: ' + url));
  };
  const click = () => (listeners.pointerdown || []).forEach((fn) => fn({ type: 'pointerdown' }));
  return { w, loaded, click };
}
const settle = async () => { for (let i = 0; i < 20; i++) await new Promise((r) => setTimeout(r, 0)); };
const FAKE_TONE = 'data:text/javascript,' + encodeURIComponent(`
  class P { constructor() { this.value = 0; } rampTo(v) { this.value = v; } }
  class N { constructor(v) { this.input = {}; this.gain = v; this.frequency = new P(); this.wet = new P(); this.volume = new P(); }
    connect() { return this; } toDestination() { return this; } dispose() {} }
  export default { start: async () => {}, Gain: N, Limiter: N, Volume: N, Reverb: N, Filter: N,
    dbToGain: (d) => 10 ** (d / 20), immediate: () => 0, getContext: () => ({ rawContext: {} }) };`);
const played = [];
let soundModule = null;
async function realSound() {
  if (soundModule) return soundModule;
  soundModule = await import('../packages/sound/index.js');
  const inst = (id, extra = {}) => ({ id, name: id, category: 'other', tail: 0, ...extra, create: () => ({
    noteOn: (n, v) => played.push([id, 'on', n, +v.toFixed(3)]), noteOff: (n) => played.push([id, 'off', n]),
    releaseAll: () => played.push([id, 'releaseAll']), dispose() {} }) });
  soundModule.registerInstrument(inst('test/keys'));
  soundModule.registerInstrument(inst('test/sampler', { fallback: 'test/keys', create: () => ({ ready: Promise.resolve(),
    noteOn: (n, v) => played.push(['test/sampler', 'on', n, +v.toFixed(3)]), noteOff: (n) => played.push(['test/sampler', 'off', n]), dispose() {} }) }));
  return soundModule;
}
function fakeDrums(log) {
  return { PATTERNS: { 'four on floor': {} }, drumEngine: () => ({ context: null, enable: async () => { log.push('kit enabled'); }, noteOn: (n, v) => log.push(['kit', n, v]) }) };
}

test('0.4.0: a sketch that calls none of it gets the names, and nothing loads or changes', () => {
  const { w, loaded, click } = kitPage();
  assert.equal(w.OAVp5.version, '0.7.0');
  for (const n of ['startSound', 'stopSound', 'startDrums', 'stopDrums', 'cue']) assert.equal(typeof w[n], 'function', n);
  assert.deepEqual([w.soundIsOn, w.drumsAreOn, w.drumStep, w.drumBar, w.drumBpm, w.cueName], [false, false, 0, 0, 112, '']);
  w.midi.play(60, 0.8); w.midi.play(60, 0); w.midi.input([0x99, 36, 100]); click();
  assert.equal(w.OAVp5.sound.state, 'off');
  assert.equal(w.OAVp5.drums.state, 'off');
  assert.deepEqual(loaded, [], 'no module was asked for');
  for (const n of [...NEW_NAMES, ...NEW_CALLBACKS]) assert.ok(!['getAudioContext', 'userStartAudio', 'setBPM', 'loadSound', 'soundFormats', 'outputVolume', 'midiToFreq', 'freqToMidi'].includes(n), n);
});

test('sound: startSound() waits for the first click, then every note goes through @openav/sound; pads play the kit', async () => {
  const kitLog = [];
  const { w, loaded, click } = kitPage({ OAV_P5: { tone: FAKE_TONE } }, { 'packages/sound/index.js': realSound, 'packages/drums/index.js': () => fakeDrums(kitLog), [FAKE_TONE]: () => import(FAKE_TONE) });
  await realSound(); played.length = 0;
  const on = w.startSound('test/keys');
  await settle();
  assert.equal(w.OAVp5.sound.state, 'waiting', 'no click yet: a browser would keep it quiet');
  assert.equal(w.soundIsOn, false);
  w.midi.play(60, 0.8);
  assert.deepEqual(played, [], 'not heard before the click');
  assert.ok(loaded.some((u) => /packages\/sound\/index\.js\?v=p5-0\.7\.0$/.test(u)), 'loaded from next to this file, stamped with the version');
  click();
  assert.equal(await on, true);
  assert.equal(w.soundIsOn, true);
  assert.equal(w.OAVp5.sound.state, 'on');
  w.midi.play(60, 0.8); w.midi.play(60, 0);                          // the 🎹 on screen / midi.play
  w.midi.input([0x90, 64, 127], 'hardware'); w.midi.input([0x80, 64, 0], 'hardware');
  w.midi.input([0x90, 67, 64], 'phone');
  assert.deepEqual(played, [['test/keys', 'on', 60, 0.803], ['test/keys', 'off', 60], ['test/keys', 'on', 64, 1], ['test/keys', 'off', 64], ['test/keys', 'on', 67, 0.504]]);
  w.midi.input([0x99, 36, 127]);                                      // a pad (channel 10): the drum kit, not the keys
  await settle();
  assert.ok(kitLog.some((x) => Array.isArray(x) && x[1] === 36 && x[2] === 1), JSON.stringify(kitLog));
  assert.equal(played.filter((p) => p[2] === 36).length, 0, 'a pad is never a piano note');
  w.midi.input([0xB0, 64, 127]); w.midi.play(72, 1); w.midi.play(72, 0);   // sustain pedal holds the note-off
  assert.deepEqual(played.slice(-1), [['test/keys', 'on', 72, 1]]);
  w.midi.input([0xB0, 64, 0]);
  assert.deepEqual(played.slice(-1), [['test/keys', 'off', 72]]);
  const n = played.length;
  w.stopSound();
  assert.equal(w.soundIsOn, false);
  w.midi.play(62, 1);
  assert.equal(played.length, n + 1, 'stopSound releases what rings…');
  assert.equal(played.at(-1)[1], 'releaseAll', '…and nothing new sounds');
  assert.equal(await w.startSound(), true, 'on again at once: the engine is already running');
  w.midi.play(62, 1);
  assert.deepEqual(played.at(-1), ['test/keys', 'on', 62, 1]);
});

test('sound: a sampler starts on its fallback, then takes over; startSound(id) switches; an unknown id changes nothing', async () => {
  const { w, click } = kitPage({ OAV_P5: { tone: FAKE_TONE } }, { 'packages/sound/index.js': realSound, 'packages/drums/index.js': () => fakeDrums([]), [FAKE_TONE]: () => import(FAKE_TONE) });
  await realSound(); played.length = 0;
  click();                                                            // a click before: it starts at once
  assert.equal(await w.startSound('test/sampler'), true);
  await settle();
  assert.equal(w.OAVp5.sound.instrument, 'test/sampler');
  w.midi.play(60, 1);
  assert.deepEqual(played.at(-1), ['test/sampler', 'on', 60, 1]);
  await w.startSound('test/keys'); await settle();
  w.midi.play(61, 1);
  assert.deepEqual(played.at(-1), ['test/keys', 'on', 61, 1]);
  await w.startSound('no/such'); await settle();
  assert.equal(w.OAVp5.sound.instrument, 'test/keys');
});

test('sound=off: startSound() is a no-op; sound=<instrument> starts by itself and waits for the click', async () => {
  const a = kitPage({ OAV_P5: { sound: 'off' } });
  assert.equal(await a.w.startSound('piano'), false);
  assert.equal(a.w.OAVp5.sound.state, 'off');
  assert.deepEqual(a.loaded, []);
  const b = kitPage({ OAV_P5: { sound: 'test/keys', tone: FAKE_TONE } });
  assert.equal(b.w.OAVp5.sound.state, 'loading');
  assert.ok(b.loaded.length === 0 || b.loaded.every((u) => /packages\/sound/.test(u)));
});

test('drums: each hit calls drumHit and the microphone callbacks; steps move drumStep / drumBar and call stepStarted / barStarted', () => {
  const log = [];
  const w = page({ drumHit: (l, v) => log.push(['hit', l, v]), kickDetected: (v) => log.push(['kick', v]), snareDetected: (v) => log.push(['snare', v]),
    hatDetected: (v) => log.push(['hat', v]), beatDetected: (v) => log.push(['beat', v]), barStarted: (b) => log.push(['bar', b]),
    stepStarted: (s, b) => log.push(['step', s, b]) });
  const d = w.OAVp5.drums;
  d._step(0, 0); d._hit('kick', 0.9); d._hit('hat', 0.5);
  d._step(4, 4); d._hit('snare', 0.7); d._hit('clap', 0.6);
  assert.deepEqual(log, [['bar', 1], ['step', 0, 1], ['hit', 'kick', 0.9], ['kick', 0.9], ['beat', 0.9], ['hit', 'hat', 0.5], ['hat', 0.5],
    ['step', 4, 1], ['hit', 'snare', 0.7], ['snare', 0.7], ['beat', 0.7], ['hit', 'clap', 0.6], ['snare', 0.6]]);
  assert.equal(w.drumStep, 4); assert.equal(w.drumBar, 1);
  d._step(0, 16);
  assert.equal(w.drumBar, 2); assert.deepEqual(log.slice(-2), [['bar', 2], ['step', 0, 2]]);
  const heard = []; const off = d.on('hit', (l) => heard.push(l)); d._hit('hat', 0.2); off(); d._hit('hat', 0.2);
  assert.deepEqual(heard, ['hat']);
  assert.throws(() => d.on('nope', () => {}), /unknown drums event/);
});

test('drums: a drum beat makes `beat` true for one frame, like a microphone beat', () => {
  const w = page({ frameCount: 1 });
  assert.equal(w.beat, false);
  w.OAVp5.drums._step(0, 0); w.OAVp5.drums._hit('kick', 1);
  w.frameCount = 2; assert.equal(w.beat, true);
  w.frameCount = 3; assert.equal(w.beat, false);
});

test('cue(bar, name, every): fires on its step, repeats, half bars work, a repeated call adds nothing; cueName', () => {
  const fired = [];
  const w = page({ cueFired: (name, bar) => fired.push([name, bar]) });
  w.cue(1, 'calm', 4); w.cue(3, 'storm', 4); w.cue(2.5, 'flash'); w.cue(3, 'storm', 4); w.cue(0, 'never');
  assert.equal(w.OAVp5.drums.cues.length, 3);
  for (let n = 0; n < 16 * 9; n++) w.OAVp5.drums._step(n % 16, n);
  assert.deepEqual(fired, [['calm', 1], ['flash', 2], ['storm', 3], ['calm', 5], ['storm', 7], ['calm', 9]]);
  assert.equal(w.cueName, 'calm');
});

test("a sketch's own drumBar / cueName / soundIsOn is left alone", () => {
  const w = page({ drumBar: 'mine', soundIsOn: 'also mine' });
  w.cue(1, 'a');
  w.OAVp5.drums._step(0, 0);
  assert.equal(w.drumBar, 'mine');
  assert.equal(w.soundIsOn, 'also mine');
  assert.equal(w.cueName, 'a');
  w.cueName = 'set by the sketch';
  w.OAVp5.drums._step(0, 16);
  assert.equal(w.cueName, 'set by the sketch');
  assert.equal(w.OAVp5.drums.lastCue, 'a');
});

test('startDrums() with no page to draw on (no document) says false instead of throwing', async () => {
  const w = page();
  assert.equal(await w.startDrums('breakbeat', 120), false);
  assert.equal(w.drumsAreOn, false);
});

test('a microphone sketch moved to the drum machine: defining kickDetected() no longer opens the microphone on the first click', () => {
  const run = (drums) => {
    const navigator = { mediaDevices: { getUserMedia() { return Promise.reject(Object.assign(new Error('no'), { name: 'NotAllowedError' })); } } };
    const { w, click } = kitPage({ navigator, kickDetected() {} });
    if (drums) w.startDrums();
    click();
    return w.OAVp5.mic.state;
  };
  assert.equal(run(false), 'asking', 'without drums: as in 0.3.0, the click starts the microphone');
  assert.equal(run(true), 'off', 'with startDrums(): the drums feed kickDetected, the microphone stays off');
});

// ---------------------------------------------------------------- hints, micLevel, the knob both ways, the check-up (0.4.0, second part)
// Browser half (the cards on the page, a refused microphone, a throwing callback, hints=off, OPC): p5/test/hints-smoke.cjs.
const ids = (w) => [...w.OAVp5.hints].map((h) => h.id);
const chrome = (more = {}) => ({ navigator: { requestMIDIAccess: () => Promise.resolve({ inputs: new Map(), addEventListener() {} }) }, ...more });
function loadPage(globals = {}) {
  const on = {};
  const w = page({ addEventListener: (type, fn) => { (on[type] = on[type] || []).push(fn); }, ...globals });
  const fire = async (type) => { (on[type] || []).forEach((fn) => fn({ type })); await settle(); };
  return { w, fire };
}

test('hints: a sketch that uses none of it gets none, whatever happens on the page', async () => {
  const { w, fire } = loadPage();                            // Safari-like: no Web MIDI, no microphone
  await fire('load'); await fire('pointerdown'); await fire('keydown');
  w.midi.play(60, 0.8); w.midi.input([0xB0, 74, 127]);
  assert.deepEqual(ids(w), []);
});

test("hints: an error inside the sketch's notePressed() is said with its file and line, and the next note still plays", () => {
  let n = 0;
  const w = page({ notePressed: () => { n++; const e = new TypeError("Cannot read properties of undefined (reading 'x')");
    e.stack = "TypeError: Cannot read properties of undefined (reading 'x')\n    at notePressed (https://preview.openprocessing.org/sketch/123/mySketch.js:23:9)\n    at call (https://openaudiovisual.com/p5/oav-p5.js:280:10)"; throw e; } });
  w.midi.play(60, 1); w.midi.play(62, 1); w.midi.play(64, 1);
  assert.equal(n, 3, 'every note still reaches the sketch');
  const h = [...w.OAVp5.hints].filter((x) => x.id.startsWith('err:'));
  assert.equal(h.length, 1, 'the same error is said once');
  assert.ok(ids(w).includes('midiNone'), 'and this Safari-like page (no Web MIDI) tells a sketch with notePressed() to use the 🎹 or a phone');
  assert.equal(h[0].kind, 'error');
  assert.match(h[0].what, /notePressed\(\).*reading 'x'/);
  assert.match(h[0].why, /mySketch\.js/);
  assert.match(h[0].why + h[0].next, /23/);
});

test('hints: in Chinese for a Chinese browser — what happened, why, and what to press', () => {
  const w = page({ navigator: { language: 'zh-TW' }, kickDetected: () => { throw new Error('boom'); } });
  w.OAVp5.drums._hit('kick', 1);
  const h = w.OAVp5.hints[0];
  assert.match(h.what, /你的 kickDetected\(\) 出錯了：boom/);
  assert.match(h.why, /草圖還在跑/);
  assert.match(h.next, /console/);
});

test('hints: why the microphone did not come — blocked, blocked by the iframe, by the system, missing, busy, http', async () => {
  const run = async (error, globals = {}) => {
    const navigator = { language: 'zh-TW', mediaDevices: { getUserMedia: () => Promise.reject(error) } };
    const w = page({ navigator, ...globals });
    w.OAVp5._import = () => Promise.resolve({ AudioAnalyzer: class { enableMic() { return navigator.mediaDevices.getUserMedia(); } } });
    await w.startMic(); await settle();
    return [ids(w).join(','), w.OAVp5.hints[0] && w.OAVp5.hints[0].next];
  };
  const err = (name, message = '') => Object.assign(new Error(message), { name });
  const denied = await run(err('NotAllowedError', 'Permission denied'));
  assert.equal(denied[0], 'micDenied'); assert.match(denied[1], /鎖頭/);
  assert.equal((await run(err('NotAllowedError', 'Permission denied by system')))[0], 'micSystem');
  const framed = { self: {}, top: {}, document: { featurePolicy: { allowsFeature: (f) => f !== 'microphone' }, addEventListener() {} } };
  assert.equal((await run(err('NotAllowedError', 'Permission denied'), framed))[0], 'micFrame');
  assert.equal((await run(err('NotFoundError')))[0], 'micMissing');
  assert.equal((await run(err('NotReadableError')))[0], 'micBusy');
  const http = page({ location: { search: '', protocol: 'http:', hostname: 'example.com' }, navigator: {} });
  await http.startMic();
  assert.deepEqual(ids(http), ['micInsecure']);
});

test('hints: no Web MIDI (Safari) or a refused MIDI permission is said only to a sketch that plays from MIDI', async () => {
  const a = loadPage({ notePressed() {} });
  await a.fire('load');
  assert.deepEqual(ids(a.w), ['midiNone']);
  assert.equal(a.w.OAVp5.hints[0].kind, 'info');
  const b = loadPage();                                       // no MIDI callbacks: nothing to say …
  await b.fire('load');
  assert.deepEqual(ids(b.w), []);
  void b.w.knob1;                                             // … until it reads a knob
  assert.deepEqual(ids(b.w), ['midiNone']);
  const denied = () => Promise.reject(Object.assign(new Error('no'), { name: 'NotAllowedError' }));
  const c = loadPage({ navigator: { requestMIDIAccess: denied }, knobMoved() {} });
  await settle();
  assert.equal(c.w.midi.hardware, 'denied');
  assert.deepEqual(ids(c.w), ['midiDenied']);
});

test("hints: the sketch's own `let note` (not a window property) is found and named, once; var and assignment too", () => {
  const w = page(chrome());
  vm.runInContext('let note = "mine";', w);
  w.midi.play(60, 1); w.midi.play(61, 1);
  assert.equal(w.midi.last.note, 61);
  assert.deepEqual(ids(w), ['own:note']);
  assert.match(w.OAVp5.hints[0].next, /midi\.last\.note/);
  const v = page(chrome({ velocity: 'mine' }));
  v.midi.play(60, 1);
  assert.deepEqual(ids(v), ['own:velocity']);
  const k = page(chrome());
  vm.runInContext('let knob1 = 0.5;', k);
  k.midi.input([0xB0, 74, 127]);
  assert.deepEqual(ids(k), ['own:knob1']);
  assert.match(k.OAVp5.hints[0].next, /knob\(1\)/);
  const plain = page(chrome());                              // no own names: our note is written and nothing is said
  plain.midi.play(60, 1); plain.midi.input([0xB0, 74, 127]);
  assert.equal(plain.note, 60); assert.equal(plain.knob1, 1);
  assert.deepEqual(ids(plain), []);
});

test('the knob both ways: a sketch that reads knob1 takes knob 1 from OPC\'s first slider, says so once, and the wiring shows it', () => {
  const OPC = fakeOPC();
  const w = page(chrome({ OPC }));
  w.midi.input([0xB0, 74, 127]);
  assert.equal(OPC.options.radius.value, 100, 'before the sketch reads knob1: knob 1 drives radius');
  assert.equal(w.knob1, 1);                                   // the sketch reads knob1 (gravity, say)
  assert.deepEqual(ids(w), ['both:knob1']);
  assert.match(w.OAVp5.hints[0].why, /radius/);
  w.midi.input([0xB0, 74, 0]);
  assert.equal(w.knob1, 0);
  assert.equal(OPC.options.radius.value, 100, 'knob 1 no longer moves radius');
  w.midi.input([0xB0, 71, 0]);
  assert.equal(OPC.options.speed.value, 0, 'knob 2 still drives the second slider');
  assert.deepEqual(plain(w.midi.wiring()).slice(0, 2), [{ control: 'knob1', name: 'radius', sketch: true }, { control: 'knob2', name: 'speed' }]);
  void w.knob1; void w.knob(1);
  assert.equal(w.OAVp5.hints.length, 1, 'said once');
  const off = page(chrome({ OPC: fakeOPC(), OAV_P5: { opc: 'off' } }));
  void off.knob1;
  assert.deepEqual(ids(off), [], 'opc=off: nothing to collide with');
});

test('micLevel is how loud it sounds: a quiet voice (RMS 0.02) is clearly up, shouting (0.2) is near 1, the room is 0', () => {
  const { w } = micPage({ OAV_P5: { mic: 'click' } });
  const m = w.OAVp5.mic;
  const at = (rms, t) => { m._frame(FEAT({ rms }), t); return w.micLevel; };
  const room = at(0.001, 0), soft = at(0.02, 16), loud = at(0.2, 32);
  assert.equal(room, 0, 'a quiet room (-60 dB)');
  assert.ok(soft > 0.35 && soft < 0.6, 'a quiet voice: ' + soft);
  assert.ok(loud > 0.85 && loud <= 1, 'shouting: ' + loud);
  assert.ok(50 + soft * 300 > 150, 'circle(…, 50 + micLevel * 300) grows by a third of the screen when someone talks');
  assert.equal(m.rms, 0.2); assert.equal(Math.round(m.db), -14);
  // a humming classroom (-42 dB for 20 s) becomes the new 0: the room rests near 0, a voice over it still reads
  let t = 100;
  for (let i = 0; i < 1200; i++) at(0.008, (t += 16.7));
  assert.ok(m.floor > -46 && m.floor <= -45, 'floor ' + m.floor);
  assert.ok(at(0.008, (t += 16.7)) < 0.05, 'the room itself');
  assert.ok(at(0.04, (t += 16.7)) > 0.3, 'a voice over it (-28 dB)');
  // and falls back within a second or two when the room goes quiet
  for (let i = 0; i < 120; i++) at(0.0005, (t += 16.7));
  assert.ok(m.floor < -60, 'floor ' + m.floor);
});

test('micSensitivity(): twice as sensitive is +6 dB on micLevel and ×2 on the bands; it says what it is', () => {
  const { w } = micPage({ OAV_P5: { mic: 'click' } });
  w.OAVp5.mic._frame(FEAT({ rms: 0.01 }), 0);
  const before = w.micLevel;
  assert.equal(w.micSensitivity(), 1);
  assert.equal(w.micSensitivity(2), 2);
  w.OAVp5.mic._frame(FEAT({ rms: 0.01 }), 16);
  assert.ok(Math.abs(w.micLevel - before - 6 / 44) < 0.02, `${before} → ${w.micLevel}`);
  assert.equal(w.bass, 1); assert.equal(w.mid, 0.5);
  assert.equal(w.OAVp5.mic.gain, 2, "0.3.0's mic.gain is the same knob");
});

test('OAVp5.check(): microphone, MIDI, sound, drums, wiring and the hints, as one text to screenshot', () => {
  const w = page({ OPC: fakeOPC(), navigator: { language: 'zh-TW', userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/141.0 Safari/537.36' } });
  void w.knob1; w.midi.play(60, 1);
  const r = w.OAVp5.check({ show: false });
  assert.equal(r.version, '0.7.0');
  assert.equal(r.browser, 'Chrome 141 · macOS');
  assert.equal(r.midi.webMidi, false);
  assert.equal(r.microphone.state, 'off');
  for (const line of ['麥克風：關著', 'MIDI：這個瀏覽器沒有 Web MIDI', '聲音：關著', '鼓機：關著', '接線：旋鈕1 → knob1（草圖；radius 改用滑桿） · 旋鈕2 → speed（OPC）', '提示過：這個瀏覽器沒有 Web MIDI；旋鈕1交給你的草圖了']) assert.ok(r.text.includes(line), line + '\n' + r.text);
});

// ---------------------------------------------------------------- recording (0.5.0)
// Browser half (p5 1.11.11 and 2.x, Chrome and Chromium, the downloaded files read back with ffprobe / volumedetect, the ⏺ button,
// the red dot, the cards, 📷): p5/test/rec-smoke.cjs. Here: the real @openav/record Recorder over a stand-in MediaRecorder.
const REC_NAMES = ['startRecording', 'stopRecording', 'recordingIsOn', 'recordingSaved'];

/** a MediaRecorder stand-in: says yes to the types `formats` matches, hands over 8 KB a second (and on stop) */
function fakeRecorder(formats = /mp4/) {
  const made = [];
  class FakeMR {
    static isTypeSupported(t) { return formats.test(t); }
    constructor(stream, opts = {}) {
      if (opts.mimeType && !formats.test(opts.mimeType)) throw Object.assign(new Error('type'), { name: 'NotSupportedError' });
      this.stream = stream; this.opts = opts; this.state = 'inactive';
      this.mimeType = opts.mimeType || (formats.test('video/webm') ? 'video/webm;codecs=vp8,opus' : 'video/mp4');
      made.push(this);
    }
    start(slice) {
      this.state = 'recording';
      this._iv = setInterval(() => this.ondataavailable({ data: new Blob([new Uint8Array(8192)]) }), slice || 1000);
      this._iv.unref?.();
    }
    stop() {
      clearInterval(this._iv); this.state = 'inactive';
      setTimeout(() => { this.ondataavailable({ data: new Blob([new Uint8Array(8192)]) }); this.onstop(); }, 5);
    }
  }
  return { FakeMR, made };
}
class FakeStream {
  constructor(tracks = []) { this.tracks = tracks; }
  getVideoTracks() { return this.tracks.filter((t) => t.kind === 'video'); }
  getAudioTracks() { return this.tracks.filter((t) => t.kind === 'audio'); }
}
const track = (kind) => ({ kind, readyState: 'live', stopped: false, stop() { this.stopped = true; } });
const fakeCanvas = (w = 641, h = 361) => ({ width: w, height: h, captureStream() { return new FakeStream([track('video')]); } });
/** WebAudio enough for the mix: every MediaStreamSource it makes is kept, the analyser reads `FakeAC.level` */
class FakeNode { constructor(ctx, kind) { this.context = ctx; this.kind = kind; this.to = []; } connect(n) { this.to.push(n); return n; } disconnect() { this.to = []; } }
class FakeAC {
  constructor() { this.state = 'running'; this.sources = []; FakeAC.made.push(this); }
  createGain() { return Object.assign(new FakeNode(this, 'gain'), { gain: { value: 1 } }); }
  createDynamicsCompressor() { const n = new FakeNode(this, 'limiter'); for (const k of ['threshold', 'knee', 'ratio', 'attack', 'release']) n[k] = { value: 0 }; return n; }
  createMediaStreamDestination() { return Object.assign(new FakeNode(this, 'dest'), { stream: new FakeStream([track('audio')]) }); }
  createAnalyser() { return Object.assign(new FakeNode(this, 'analyser'), { fftSize: 2048, getFloatTimeDomainData: (b) => b.fill(FakeAC.level) }); }
  createMediaStreamSource(s) { const n = Object.assign(new FakeNode(this, 'source'), { mediaStream: s }); this.sources.push(n); return n; }
  resume() { this.state = 'running'; return Promise.resolve(); }
  close() { this.state = 'closed'; return Promise.resolve(); }
}
FakeAC.made = []; FakeAC.level = 0.2;
const fakeMicModule = (stream) => ({ AudioAnalyzer: class { constructor() { this.ctx = { state: 'running', close() {} }; } enableMic() { this.source = { mediaStream: stream }; return Promise.resolve(true); } update() { return null; } } });
const until = async (fn, ms = 3000) => { const t0 = Date.now(); while (!fn() && Date.now() - t0 < ms) await new Promise((r) => setTimeout(r, 10)); return fn(); };
/** @openav/record's Recorder reads MediaRecorder and MediaStream from its own realm (here node's): lend it the stand-ins */
function lend(FakeMR) {
  const keep = { MediaRecorder: globalThis.MediaRecorder, MediaStream: globalThis.MediaStream };
  globalThis.MediaRecorder = FakeMR; globalThis.MediaStream = FakeStream;
  return () => { globalThis.MediaRecorder = keep.MediaRecorder; globalThis.MediaStream = keep.MediaStream; };
}
const recorderModule = () => import('../packages/record/recorder.js');

test('0.5.0: startRecording / stopRecording / recordingIsOn are there; a sketch that records nothing builds no MediaRecorder and loads nothing', () => {
  const { FakeMR, made } = fakeRecorder();
  const { w, loaded, click } = kitPage({ MediaRecorder: FakeMR, AudioContext: FakeAC });
  FakeAC.made.length = 0;
  assert.equal(w.OAVp5.version, '0.7.0');
  assert.equal(typeof w.startRecording, 'function');
  assert.equal(typeof w.stopRecording, 'function');
  assert.equal(w.recordingIsOn, false);
  assert.equal(w.OAVp5.record.state, 'off');
  click(); w.midi.play(60, 0.8); w.midi.play(60, 0);
  assert.equal(made.length, 0, 'no MediaRecorder');
  assert.equal(FakeAC.made.length, 0, 'no AudioContext');
  assert.deepEqual(loaded, [], 'packages/record is not asked for');
  assert.deepEqual(ids(w), [], 'no card');
});

test('recording: startRecording(seconds) records the canvas with @openav/record\'s Recorder as MP4, stops by itself, names the file, calls recordingSaved(info)', async () => {
  const { FakeMR, made } = fakeRecorder(/mp4/);
  const back = lend(FakeMR);
  try {
    const saved = [];
    const { w, loaded } = kitPage({ MediaRecorder: FakeMR, recordingSaved: (i) => saved.push(i) }, { 'packages/record/recorder.js': recorderModule });
    const heard = []; w.OAVp5.record.on('saved', (i) => heard.push(i.name));
    const canvas = fakeCanvas(641, 361);
    assert.equal(await w.startRecording({ seconds: 0.3, canvas }), true);
    assert.equal(w.recordingIsOn, true);
    assert.equal(w.OAVp5.record.state, 'on');
    assert.equal(await w.startRecording({ canvas }), true, 'a second start while it runs: still the one take');
    assert.equal(made.length, 1);
    assert.ok(loaded.some((u) => /packages\/record\/recorder\.js\?v=p5-0\.7\.0$/.test(u)), 'loaded from next to this file, stamped with the version');
    assert.equal(made[0].opts.mimeType, 'video/mp4;codecs=avc1.640033,mp4a.40.2', 'MP4 (H.264 + AAC) first');
    assert.equal(made[0].opts.videoBitsPerSecond, 4e6, 'a small canvas still gets 4 Mb/s');
    assert.equal(made[0].stream.getVideoTracks().length, 1);
    assert.equal(made[0].stream.getAudioTracks().length, 0, 'no WebAudio on this page: no audio track');
    await until(() => saved.length === 1);
    const i = saved[0];
    assert.match(i.name, /^oav-\d{8}-\d{6}\.mp4$/);
    assert.equal(i.format, 'mp4');
    assert.deepEqual([i.width, i.height], [640, 360], 'H.264 is even-sized: the info says what the file is');
    assert.ok(i.bytes >= 8192 && i.blob && i.blob.size === i.bytes);
    assert.ok(i.seconds >= 0.2 && i.seconds < 1.5, String(i.seconds));
    assert.equal(i.audio, false);
    assert.deepEqual([...i.warnings], []);
    assert.deepEqual(heard, [i.name], 'record.on("saved") hears it too');
    assert.equal(w.recordingIsOn, false);
    assert.equal(w.OAVp5.record.state, 'off');
    assert.equal(w.OAVp5.record.last, i);
    assert.equal(await w.stopRecording(), null, 'nothing to stop');
    assert.ok(canvas.captureStream && made[0].stream.getVideoTracks()[0].stopped, 'the canvas track is stopped');
  } finally { back(); }
});

test('recording: the mix takes the microphone (it is on by default, record=nomic leaves it out), a source that comes on during a take joins it', async () => {
  for (const nomic of [false, true]) {
    const { FakeMR, made } = fakeRecorder(/mp4/);
    const back = lend(FakeMR);
    try {
      FakeAC.made.length = 0; FakeAC.level = 0.2;
      const micStream = new FakeStream([track('audio')]);
      const navigator = { mediaDevices: { getUserMedia() { return Promise.resolve(micStream); } } };
      const { w } = kitPage({ MediaRecorder: FakeMR, AudioContext: FakeAC, navigator, OAV_P5: nomic ? { record: 'nomic' } : {} },
        { 'packages/record/recorder.js': recorderModule, 'packages/audio/index.js': () => fakeMicModule(micStream) });
      assert.equal(await w.startRecording({ canvas: fakeCanvas() }), true);
      const mix = FakeAC.made[0];
      assert.ok(mix, 'the mix: one AudioContext, made by startRecording');
      assert.equal(made[0].stream.getAudioTracks().length, 1, 'ONE audio track, the mix');
      assert.deepEqual([...w.OAVp5.record.sources], [], 'nothing sounds yet');
      assert.equal(await w.startMic(), true);                          // the microphone comes on during the take
      await until(() => mix.sources.length > 0, nomic ? 600 : 3000);
      const tapped = mix.sources.some((n) => n.mediaStream === micStream);
      const info = await w.stopRecording();
      if (!nomic) {
        assert.ok(tapped, 'the microphone joined the take');
        assert.deepEqual([...info.sources], ['mic']);
        assert.equal(info.audio, true); assert.equal(info.heard, true);
        assert.deepEqual([...info.warnings], []);
        assert.equal(mix.state, 'closed', 'the mix is closed with the take');
      } else {
        assert.ok(!tapped, 'record=nomic: the microphone stays out');
        assert.deepEqual([...info.sources], []);
        assert.deepEqual([...info.warnings], [], 'nothing was meant to be heard: no warning');
      }
      w.stopMic();
    } finally { back(); }
  }
});

test('recording: a sound that was on but silent, WebM only, no MediaRecorder, no canvas, record=off: each says so (in Chinese for a Chinese browser)', async () => {
  // a microphone on, and nothing reaches the mix
  {
    const { FakeMR } = fakeRecorder(/mp4/);
    const back = lend(FakeMR);
    try {
      FakeAC.level = 0;
      const micStream = new FakeStream([track('audio')]);
      const { w } = kitPage({ MediaRecorder: FakeMR, AudioContext: FakeAC, navigator: { language: 'zh-TW', mediaDevices: { getUserMedia: () => Promise.resolve(micStream) } } },
        { 'packages/record/recorder.js': recorderModule, 'packages/audio/index.js': () => fakeMicModule(micStream) });
      await w.startMic();
      await w.startRecording({ canvas: fakeCanvas() });
      await new Promise((r) => setTimeout(r, 300));
      const info = await w.stopRecording();
      assert.deepEqual([...info.warnings], ['recSilent']);
      const h = w.OAVp5.hints.find((x) => /^recSilent/.test(x.id));
      assert.equal(h.what, '影片裡沒有聲音');
      assert.match(h.why, /🎤 麥克風開著/);
      assert.ok(w.OAVp5.hints.some((x) => /^recSaved/.test(x.id) && /無聲/.test(x.why)), 'the saved card says silent');
      w.stopMic();
    } finally { back(); FakeAC.level = 0.2; }
  }
  // WebM only (Firefox, Chrome before 126)
  {
    const { FakeMR, made } = fakeRecorder(/webm/);
    const back = lend(FakeMR);
    try {
      const { w } = kitPage({ MediaRecorder: FakeMR, navigator: { language: 'zh-TW', userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:131.0) Gecko/20100101 Firefox/131.0' } }, { 'packages/record/recorder.js': recorderModule });
      assert.equal(w.OAVp5.record.formats().mp4, false);
      await w.startRecording({ canvas: fakeCanvas() });
      assert.equal(made[0].opts.mimeType, 'video/webm;codecs=vp9,opus');
      const info = await w.stopRecording();
      assert.equal(info.format, 'webm'); assert.match(info.name, /\.webm$/);
      assert.deepEqual([...info.warnings], ['recWebm']);
      const h = w.OAVp5.hints.find((x) => /^recWebm/.test(x.id));
      assert.equal(h.what, '這段是 WebM：IG 不收');
      assert.match(h.why, /^Firefox 131 · macOS 不能直接錄 MP4/);
      assert.match(w.OAVp5.check({ show: false }).text, /錄影：只能錄 WebM（IG 不收/);
    } finally { back(); }
  }
  // an MP4 the browser says yes to and then refuses: the WebM instead
  {
    const { FakeMR, made } = fakeRecorder(/mp4|webm/);
    const refuse = class extends FakeMR { start(s) { if (/mp4/.test(this.mimeType)) throw Object.assign(new Error('no encoder'), { name: 'NotSupportedError' }); super.start(s); } };
    const back = lend(refuse);
    try {
      const { w } = kitPage({ MediaRecorder: refuse }, { 'packages/record/recorder.js': recorderModule });
      assert.equal(await w.startRecording({ canvas: fakeCanvas() }), true);
      assert.deepEqual(made.map((m) => m.opts.mimeType), ['video/mp4;codecs=avc1.640033,mp4a.40.2', 'video/webm;codecs=vp9,opus']);
      assert.equal((await w.stopRecording()).format, 'webm');
    } finally { back(); }
  }
  // no MediaRecorder (an old Safari), no canvas yet, record=off
  {
    const a = kitPage({ navigator: { language: 'zh-TW' } });
    assert.equal(await a.w.startRecording({ canvas: fakeCanvas() }), false);
    assert.equal(a.w.OAVp5.hints.find((x) => x.id === 'recNone').what, '這個瀏覽器不能錄影');
    assert.equal(await a.w.startRecording(), false);
    assert.ok(a.w.OAVp5.hints.some((x) => x.id === 'recNoCanvas'), 'no document, no canvas: said, not thrown');
    assert.deepEqual(a.loaded, []);
    const { FakeMR, made } = fakeRecorder();
    const b = kitPage({ MediaRecorder: FakeMR, OAV_P5: { record: 'off' } });
    assert.equal(await b.w.startRecording({ canvas: fakeCanvas() }), false);
    assert.equal(made.length, 0); assert.deepEqual(b.loaded, []);
    assert.match(b.w.OAVp5.check({ show: false }).text, /Recording: off \(record=off\)/);
  }
});

test('recording: what is worth saying about a take', () => {
  const w = page();
  const f = w.OAVp5.record._findings;
  const ok = { bytes: 1e6, format: 'mp4', audio: true, peak: 0.3, on: ['sound'], live: 200, frames: 180 };
  assert.deepEqual([...f(ok)], []);
  assert.deepEqual([...f({ ...ok, bytes: 900 })], ['recEmpty']);
  assert.deepEqual([...f({ ...ok, format: 'webm' })], ['recWebm']);
  assert.deepEqual([...f({ ...ok, audio: false })], ['recNoAudio']);
  assert.deepEqual([...f({ ...ok, peak: 0 })], ['recSilent']);
  assert.deepEqual([...f({ ...ok, peak: 0, on: [] })], [], 'nothing was on: silence is what it is');
  assert.deepEqual([...f({ ...ok, frames: 4 })], ['recBlack'], 'the file black, the canvas was not: WebKit 229611');
  assert.deepEqual([...f({ ...ok, frames: 4, live: 9 })], [], 'a black sketch is not a black take');
  assert.deepEqual([...f({ ...ok, frames: null })], [], 'frames this browser could not decode: no claim');
});

test('recording: the MIME list is @openav/record\'s VIDEO_MIMES with MP4 first; file names; the drum kit hands out its output', async () => {
  const { VIDEO_MIMES, pickMime } = await import('../packages/record/mime.js');
  const w = page();
  const mp4 = (m) => m.startsWith('video/mp4');
  assert.deepEqual([...w.OAVp5.record._mimes], [...VIDEO_MIMES.filter(mp4), ...VIDEO_MIMES.filter((m) => !mp4(m))]);
  assert.equal(pickMime((m) => /webm/.test(m), { prefer: 'mp4' }), w.OAVp5.record._mimes.find((m) => /webm/.test(m)));
  const d = new Date(2026, 9, 15, 18, 30, 5);
  assert.equal(w.OAVp5.record._name('', 'mp4', d), 'oav-20261015-183005.mp4');
  assert.equal(w.OAVp5.record._name('作品四 音像互動/v2', 'webm', d), 'oav-作品四-音像互動-v2-20261015-183005.webm');
  const t = page({ OAV_P5: { title: 'my piece' } });
  assert.equal(t.OAVp5.record._name(null, 'png', d), 'oav-my-piece-20261015-183005.png');
  const { drumEngine } = await import('../packages/drums/index.js');
  assert.equal(drumEngine().output, null, 'null before enable(); the gain that goes to the speakers after');
});

test('recording: none of the new names is a p5 / p5.sound name; a sketch\'s own startRecording or recordingIsOn is left alone', () => {
  const p5ish = ['saveCanvas', 'saveFrames', 'saveGif', 'createCapture', 'getAudioContext', 'userStartAudio', 'SoundRecorder', 'record', 'save'];
  for (const n of REC_NAMES) assert.ok(!p5ish.includes(n), n);
  const mine = () => 'mine';
  const w = page({ startRecording: mine, recordingIsOn: 'yes' });
  assert.equal(w.startRecording, mine);
  assert.equal(w.recordingIsOn, 'yes');
  assert.equal(typeof w.OAVp5.record.start, 'function', 'OAVp5.record.start still records');
});

test('recording: the check-up has a line for it', () => {
  const { FakeMR } = fakeRecorder(/mp4|webm/);
  const w = page({ MediaRecorder: FakeMR, navigator: { language: 'zh-TW' } });
  const r = w.OAVp5.check({ show: false });
  assert.equal(r.recording.mp4, true); assert.equal(r.recording.fps, 30); assert.equal(r.recording.limit, 300);
  assert.ok(r.text.includes('錄影：可以錄 MP4（IG 可以直接用） · 30 fps · 最長 5 分鐘'), r.text);
  const n = page({ MediaRecorder: FakeMR, OAV_P5: { record: 'nomic', recfps: 60, reclimit: 90 } });
  assert.ok(n.OAVp5.check({ show: false }).text.includes('Recording: MP4 (ready for Instagram) · 60 fps · up to 1.5 min · microphone left out'));
});

// ---------------------------------------------------------------- 0.6.0: drums on the audio clock, one line of rhythm, drumPhase
// Browser half (a real kit, a busy draw(), the score line lighting up, a hidden tab): p5/test/timing-probe.cjs and rhythm-smoke.cjs.
const realDrums = () => import('../packages/drums/index.js');
/** a stand-in for @openav/pattern (its own branch): the interface is fixed — compile(text) → { ok, error, eventsInBar } */
const stubPattern = (log = []) => ({ compile(text) {
  log.push(text);
  const bad = (code, index, length, message) => ({ ok: false, error: { code, index, length, message, hint: '' } });
  if (/\[[^\]]*$/.test(text)) return bad('unclosed', text.lastIndexOf('['), 1, 'unclosed [');
  if (/\(\d+,?\)?$/.test(text) || /\(\d+,\d+$/.test(text)) return bad('bad-euclid', text.indexOf('('), text.length - text.indexOf('('), 'bad euclid');
  const dot = text.indexOf(' . ');
  if (dot >= 0) return bad('unexpected', dot + 1, 1, 'unexpected "."');
  const w = /(^|[\s,[<])([a-z]{3,}|kik)(?=$|[\s,\]>*])/i.exec(text);
  if (w && !['rim'].includes(w[2])) return bad('unknown-word', w.index + w[1].length, w[2].length, 'unknown word');
  if (!text.trim()) return bad('empty', 0, 0, 'empty');
  return { ok: true, error: null, eventsInBar: () => [{ word: 'bd', voice: 'kick', pos: 0, dur: 0.25, vel: 1, layer: 0, token: { start: 0, end: 2 } }] };
} });

test('0.6.0: drumPhase and beatPhase are there (0 until the drums play), read what the machine hears, and are no p5 names', () => {
  const { w, loaded } = kitPage();
  assert.equal(w.drumPhase, 0); assert.equal(w.beatPhase, 0);
  assert.deepEqual(loaded, [], 'reading them loads nothing');
  w.OAVp5.drums.machine = { phase: () => ({ bar: 0.25, beat: 0.5 }) };
  assert.equal(w.drumPhase, 0.25); assert.equal(w.beatPhase, 0.5);
  assert.equal(w.OAVp5.drums.phase, 0.25);
  const mine = page({ drumPhase: 'mine' });
  assert.equal(mine.drumPhase, 'mine', "a sketch's own drumPhase is left alone");
  for (const n of ['drumPhase', 'beatPhase']) assert.ok(!['getAudioContext', 'userStartAudio', 'setBPM', 'loadSound', 'outputVolume', 'frameRate', 'deltaTime'].includes(n));
});

test('0.6.0: a step told quietly (hidden tab) moves the clock and fires cues, announces only the bar it is asked to, no stepStarted', () => {
  const log = [];
  const w = page({ barStarted: (b) => log.push(['bar', b]), stepStarted: (s, b) => log.push(['step', s, b]), cueFired: (n, b) => log.push(['cue', n, b]) });
  w.cue(2, 'storm');
  const d = w.OAVp5.drums;
  d._step(0, 0, { quiet: true, announce: false });
  d._step(0, 16, { quiet: true, announce: true });
  d._step(1, 17, { quiet: true, announce: false });
  assert.deepEqual(log, [['cue', 'storm', 2], ['bar', 2]]);
  assert.equal(w.drumBar, 2); assert.equal(w.drumStep, 1); assert.equal(w.cueName, 'storm');
});

test('0.6.0: on the real lookahead clock the sketch hears cue → barStarted → stepStarted → hits, in the order 0.5 told them', async () => {
  const { DrumScheduler, DrumTransport } = await realDrums();
  const log = [];
  const w = page({ cueFired: (n) => log.push('cue:' + n), barStarted: (b) => log.push('bar' + b), stepStarted: (s) => { if (s % 4 === 0) log.push('step' + s); },
    kickDetected: () => log.push('kick'), snareDetected: () => log.push('snare'), drumHit: (l) => { if (l === 'clap') log.push('clap'); } });
  w.cue(1, 'calm'); w.cue(2, 'storm');
  let T = 50;
  const t = new DrumTransport({ scheduler: new DrumScheduler({ bpm: 120, humanize: 0, pattern: 'breakbeat' }), heartbeat: false, now: () => T, hidden: () => false,
    onStep: (i, n, ev) => w.OAVp5.drums._step(i, n, ev), onHit: (v, vel) => w.OAVp5.drums._hit(v, vel) });
  t.start();
  while (T < 54.01) { T += 1 / 30; t.frame(); }       // 30 fps: several steps can land in one frame
  const bar2 = log.indexOf('cue:storm');
  assert.deepEqual(log.slice(0, 4), ['cue:calm', 'bar1', 'step0', 'kick']);
  assert.deepEqual(log.slice(bar2, bar2 + 4), ['cue:storm', 'bar2', 'step0', 'kick']);
  assert.equal(log.filter((x) => x === 'clap').length, 2, "breakbeat's clap, once a bar");
});

test('0.6.0: startDrums(arg) — names, grids, numbers as in 0.5; any other text is a line of rhythm, compiled once', async () => {
  const seen = [];
  const { w, loaded } = kitPage({}, { 'packages/drums/index.js': realDrums, 'packages/pattern/index.js': () => stubPattern(seen) });
  const r = (x) => w.OAVp5.drums._resolve(x);
  assert.equal(await r(null), null);
  assert.deepEqual(plain(await r('breakbeat')), { pattern: 'breakbeat' });
  const grid = { kick: 'x...x...x...x...' };
  assert.equal((await r(grid)).pattern, grid);
  assert.ok(!loaded.some((u) => /pattern/.test(u)), 'no names or grids load @openav/pattern');
  const a = await r('bd*4, hh*8');
  assert.equal(a.text, 'bd*4, hh*8'); assert.equal(typeof a.pattern.eventsInBar, 'function');
  assert.ok(loaded.some((u) => /packages\/pattern\/index\.js\?v=p5-0\.7\.0$/.test(u)), 'loaded from next to this file, the first time a line is used');
  await r('bd*4, hh*8');
  assert.deepEqual(seen, ['bd*4, hh*8'], 'the same line twice (a cue that comes back) is compiled once');
  assert.deepEqual([...w.OAVp5.hints].map((h) => h.id), [], 'no card for any of these');
});

test('0.6.0: a mistake in the line: a card in the page\'s language that says which character and how to fix it; four on floor plays', async () => {
  const { w } = kitPage({ navigator: { language: 'zh-TW' } }, { 'packages/drums/index.js': realDrums, 'packages/pattern/index.js': () => stubPattern() });
  const r = (x) => w.OAVp5.drums._resolve(x);
  assert.deepEqual(plain(await r('bd [sd')), { pattern: 'four on floor' });
  const h = [...w.OAVp5.hints];
  assert.equal(h[0].what, '節奏字串第 4 個字有問題');
  assert.match(h[0].why, /"bd ⟦\[⟧sd"/);
  assert.match(h[0].why, /「\[」打開了沒有關上/);
  assert.match(h[0].next, /補上 \]/);
  assert.match(h[0].next, /four on floor/);
  await r('bd kik');
  assert.match([...w.OAVp5.hints].at(-1).why, /不認得「kik」/);
  assert.equal([...w.OAVp5.hints].at(-1).what, '節奏字串第 4 個字有問題');
  await r('bd . sd');
  assert.match([...w.OAVp5.hints].at(-1).why, /「\.」在節奏字串裡不是休止/);
  assert.match([...w.OAVp5.hints].at(-1).next, /休止用 ~ 或 -/);
  await r('bd(3,8');
  assert.match([...w.OAVp5.hints].at(-1).why, /歐幾里得/);
  await r('Breakbeat');
  assert.match([...w.OAVp5.hints].at(-1).next, /startDrums\('breakbeat'\)/, 'a name with a capital: the card shows the spelling');
  assert.deepEqual(plain(await r('x...x...x...x...')), { pattern: 'four on floor' });
  assert.match([...w.OAVp5.hints].at(-1).next, /startDrums\(\{ kick: 'x\.\.\.x\.\.\.x\.\.\.x\.\.\.' \}\)/, "the old lane text: put it in { kick: … }");
  const en = kitPage({ navigator: { language: 'en-US' } }, { 'packages/drums/index.js': realDrums, 'packages/pattern/index.js': () => stubPattern() });
  await en.w.OAVp5.drums._resolve('bd [sd');
  assert.equal([...en.w.OAVp5.hints][0].what, 'The rhythm has a problem at character 4');
});

test('0.6.0: @openav/pattern cannot load: one card, four on floor plays', async () => {
  const { w } = kitPage({}, { 'packages/drums/index.js': realDrums });
  assert.deepEqual(plain(await w.OAVp5.drums._resolve('bd*4')), { pattern: 'four on floor' });
  assert.ok([...w.OAVp5.hints].some((h) => h.id === 'modfail:pattern'));
});

test('0.6.0: the check-up says which clock moves the drums', () => {
  const w = page();
  w.OAVp5.drums.machine = { info: () => ({ clock: 'lookahead', heartbeat: 'worker', lookahead: 0.1, late: 0, extended: false, latency: 0.012 }), phase: () => ({ bar: 0, beat: 0 }) };
  w.OAVp5.drums.state = 'on';
  const r = w.OAVp5.check({ show: false });
  assert.match(r.text, /Worker heartbeat, 0\.1 s ahead, output latency 12 ms/);
  assert.equal(r.drums.clock.heartbeat, 'worker');
});
