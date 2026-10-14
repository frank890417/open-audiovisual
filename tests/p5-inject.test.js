// oav-p5.js without a browser: one parser for every source, the state a sketch reads, the callbacks it defines.
// (The browser half — p5 1.x/2.x, the 🎹 panel, the shim, a phone over a relay — is p5/test/smoke.cjs.)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const SRC = readFileSync(new URL('../p5/oav-p5.js', import.meta.url), 'utf8');

/** a fresh "page": no document, no Web MIDI (Safari-like), whatever globals the sketch defines */
function page(globals = {}) {
  const win = { console: { info() {}, warn() {}, error() {} }, navigator: {}, location: { search: '' }, URL, URLSearchParams, Promise, setTimeout, ...globals };
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
  assert.equal(w.knob1, 0);                                         // the p5-style name still follows it
  w.midi.input([0xB0, 74, 0]);                                      // the on-screen controller: still wired
  assert.equal(OPC.options.radius.value, 0);
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
  const ours = ['micLevel', 'micIsOn', 'startMic', 'stopMic', 'bass', 'mid', 'treble', 'beat', 'beatDetected', 'kickDetected', 'snareDetected', 'hatDetected'];
  const p5sound = ['getAudioContext', 'userStartAudio', 'getOutputVolume', 'outputVolume', 'soundFormats', 'loadSound', 'createConvolver', 'getLevel', 'AudioIn', 'FFT', 'Amplitude', 'masterVolume', 'sampleRate', 'freqToMidi', 'midiToFreq', 'noteToFreq'];
  for (const n of ours) assert.ok(!p5sound.includes(n), n);
});
