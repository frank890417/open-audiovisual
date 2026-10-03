// MIDI controllers: profiles as data, bytes ⇄ events, the controller model,
// learn, LEDs, hardware routing and the Web MIDI shim — all without hardware
// (a fake MIDIAccess stands in for the device).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseMessage, encodeMessage, relativeDelta, relativeValue, bendToUnit, unitToBend, genericSignals, RELATIVE_MODES } from '../packages/midi/parse.js';
import { validateProfile, normalizeProfile, matchProfile, pickPort, profileSignals, groupsOf } from '../packages/midi/profiles.js';
import { MidiController } from '../packages/midi/controller.js';
import { MidiControllers, controllerRoutes } from '../packages/midi/manager.js';
import { createVirtualMIDIAccess, virtualRequestMIDIAccess } from '../packages/midi/virtual-access.js';
import { PROFILES, profileById } from '../packages/midi/profiles/index.js';
import { Midi } from '../packages/midi/index.js';
import { Signals } from '../packages/core/src/signals.js';
import { Params } from '../packages/core/src/params.js';
import { Mapper } from '../packages/mapping/index.js';
globalThis.performance ??= { now: () => Date.now() };

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const P = (id) => profileById(id);
/** Records every publish: [name, value, info] */
const recorder = () => { const log = []; const sink = (n, v, i) => log.push([n, v, i]); sink.log = log; sink.names = () => log.map((x) => x[0]); sink.last = (n) => [...log].reverse().find((x) => x[0] === n)?.[1]; return sink; };

// ------------------------------------------------------------------ profiles
test('every shipped profile validates; ids and signal namespaces are unique', () => {
  assert.ok(PROFILES.length >= 12);
  for (const p of PROFILES) assert.deepEqual(validateProfile(p), [], p.id);
  assert.equal(new Set(PROFILES.map((p) => p.id)).size, PROFILES.length);
  assert.equal(new Set(PROFILES.map((p) => p.short)).size, PROFILES.length);
  for (const p of PROFILES.filter((x) => x.kind === 'device')) assert.ok(p.sources.length && p.sources.every((s) => s.title), p.id + ' cites sources');
  for (const p of PROFILES.filter((x) => x.kind === 'generic')) assert.equal(normalizeProfile(p).learn, true, p.id + ' learns');
});

test('validateProfile reports every problem', () => {
  const bad = { id: 'X', short: 'cc', name: '', kind: 'device', face: { w: 10, h: 10 }, sources: [],
    sections: [{ id: 's', x: 0, y: 0, w: 20, h: 5, cols: 1, rows: 1, controls: ['a', 'zz'] }],
    controls: [{ id: 'a', type: 'knob', msg: 'cc', cc: 200 }, { id: 'b', type: 'knob', msg: 'cc', cc: 1 }, { id: 'c', type: 'knob', msg: 'cc', cc: 1 }, { id: 'last', type: 'nope', msg: 'cc', cc: 2 }] };
  const errs = validateProfile(bad).join('\n');
  for (const want of ['id "X"', 'short "cc" is reserved', 'missing name', 'cite at least one source', 'cc must be 0..127', 'both listen to cc:1:1', 'reserved', 'unknown type', 'outside the faceplate', 'unknown control "zz"', '"b" is not shown']) assert.match(errs, new RegExp(want.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), want);
});

test('MiniLab 3 mirrors the TouchDesigner tool (260830 minilab3 midi.toe)', () => {
  const p = normalizeProfile(P('minilab3'));
  const cc = (id) => p.controls.find((c) => c.id === id).cc;
  assert.deepEqual([1, 2, 3, 4, 5, 6, 7, 8].map((i) => cc('knob' + i)), [74, 71, 76, 77, 93, 18, 19, 16]);   // TD ch1ctrl75 72 77 78 94 19 20 17 (1-based)
  assert.deepEqual([1, 2, 3, 4].map((i) => cc('s' + i)), [82, 83, 85, 17]);                                 // TD ch1ctrl83 84 86 18
  const pads = p.controls.filter((c) => c.group === 'pad');
  assert.deepEqual(pads.map((c) => [c.ch, c.note]), [36, 37, 38, 39, 40, 41, 42, 43].map((n) => [10, n]));   // TD ch10n[37-44]
  const keys = p.controls.find((c) => c.type === 'keys');
  assert.deepEqual([keys.ch, keys.from, keys.to], [1, 48, 72]);                                              // TD ch1n[49-73]
  assert.equal(cc('mod'), 1);
  assert.equal(p.controls.find((c) => c.id === 'pitch').msg, 'pitchbend');
  assert.deepEqual(Object.keys(groupsOf(p)).sort(), ['encoder', 'knob', 'note', 'pad', 'pitch', 'slider']); // TD out_knob/out_slider/out_pad/out_note/out_pitch
});

test('Launchpad Mini MK3: drum-rack layout and the TD tool\'s rack colours', () => {
  const p = normalizeProfile(P('lpmini'));
  const grid = p.sections.find((s) => s.id === 'grid').controls;
  const note = (id) => p.controls.find((c) => c.id === id).note;
  assert.equal(note(grid[56]), 36);   // bottom-left
  assert.equal(note(grid[63]), 71);   // bottom-right: lower-right rack starts at 68
  assert.equal(note(grid[0]), 64);    // top-left: upper-left rack ends 52–67
  assert.equal(note(grid[7]), 99);    // top-right
  const led = (n) => p.controls.find((c) => c.note === n).led;
  assert.deepEqual([led(36).on, led(52).on, led(68).on, led(84).on], [13, 5, 49, 21]); // yellow, red, purple, green
});

test('port names find their profile; the right port of a multi-port device wins', () => {
  assert.equal(matchProfile('Minilab3 MIDI', PROFILES).profile.id, 'arturia-minilab3');
  assert.equal(matchProfile('LPMiniMK3 MIDI', PROFILES).profile.id, 'novation-launchpad-mini-mk3');
  assert.equal(matchProfile('nanoKONTROL2 SLIDER/KNOB', PROFILES).profile.id, 'korg-nanokontrol2');
  assert.equal(matchProfile('LPD8 mk2', PROFILES).profile.id, 'akai-lpd8');
  assert.equal(matchProfile('Some Unknown Synth', PROFILES), null);
  const ports = [{ name: 'Minilab3 DIN THRU' }, { name: 'Minilab3 MCU/HUI' }, { name: 'Minilab3 MIDI' }];
  assert.equal(pickPort(ports, normalizeProfile(P('minilab3'))).name, 'Minilab3 MIDI');
  assert.equal(pickPort([{ name: 'LPMiniMK3 DAW Out' }, { name: 'LPMiniMK3 MIDI Out' }], normalizeProfile(P('lpmini'))).name, 'LPMiniMK3 MIDI Out');
});

// ------------------------------------------------------------------ bytes
test('parse ⇄ encode round-trips; note-on velocity 0 is a note-off', () => {
  for (const ev of [{ type: 'noteon', ch: 10, note: 36, vel: 99 }, { type: 'noteoff', ch: 1, note: 60, vel: 0 }, { type: 'cc', ch: 16, cc: 74, value: 127 },
    { type: 'pitchbend', ch: 1, value: 16383 }, { type: 'polyat', ch: 2, note: 40, value: 5 }, { type: 'chanat', ch: 3, value: 64 }, { type: 'program', ch: 1, value: 7 }]) {
    assert.deepEqual(parseMessage(encodeMessage(ev)), ev);
  }
  assert.deepEqual(parseMessage([0x90, 60, 0]), { type: 'noteoff', ch: 1, note: 60, vel: 0 });
  assert.equal(parseMessage([0xf8]).type, 'clock');
  assert.equal(parseMessage([]), null);
});

test('14-bit pitch bend: 0 → −1, 8192 → 0, 16383 → +1, and back', () => {
  assert.equal(bendToUnit(0), -1); assert.equal(bendToUnit(8192), 0); assert.equal(bendToUnit(16383), 1);
  for (const u of [-1, -0.5, 0, 0.25, 1]) assert.ok(Math.abs(bendToUnit(unitToBend(u)) - u) < 1e-3);
  assert.deepEqual(parseMessage([0xe0, 0x00, 0x40]), { type: 'pitchbend', ch: 1, value: 8192 });
});

test('relative encoders: every encoding round-trips −63..63', () => {
  for (const m of RELATIVE_MODES) for (let d = -63; d <= 63; d++) {
    if (m === 'offset16' && d < -16) continue;    // offset16 cannot go below 0
    assert.equal(relativeDelta(relativeValue(d, m), m), d, `${m} ${d}`);
  }
  assert.equal(relativeDelta(65, 'offset64'), 1); assert.equal(relativeDelta(63, 'offset64'), -1);
  assert.equal(relativeDelta(127, 'twos'), -1); assert.equal(relativeDelta(1, 'twos'), 1);
  assert.equal(relativeDelta(65, 'signbit'), -1); assert.equal(relativeDelta(17, 'offset16'), 1);
});

test('generic signal names: legacy + per channel, never midi/cc/<ch>/<n>', () => {
  const names = (ev) => genericSignals(ev).map((s) => s.name);
  assert.deepEqual(names({ type: 'cc', ch: 2, cc: 74, value: 64 }), ['midi/cc/74', 'midi/ch/2/cc/74']);
  assert.deepEqual(names({ type: 'noteon', ch: 10, note: 36, vel: 127 }), ['midi/note/on', 'midi/ch/10/note/36']);
  assert.deepEqual(names({ type: 'pitchbend', ch: 1, value: 8192 }), ['midi/bend', 'midi/ch/1/bend']);
  const on = genericSignals({ type: 'noteon', ch: 1, note: 60, vel: 127 }, { device: 'x' })[0];
  assert.deepEqual(on.value, { note: 60, vel: 1, velocity: 127, ch: 1, device: 'x' });
  assert.ok(on.pulse);
});

// ------------------------------------------------------------------ controller
test('hardware moves a knob: profile signals only (the Midi engine already published the generic ones)', () => {
  const sink = recorder();
  const c = new MidiController(P('minilab3'), { sink });
  const seen = [];
  c.onChange((id, st, info) => id && seen.push([id, st.value, info.source]));
  c.ingest([0xb0, 74, 100], { source: 'hw' });
  assert.equal(sink.last('midi/minilab3/knob1'), 100 / 127);
  assert.equal(sink.last('midi/minilab3/knob1/raw'), 100);
  assert.equal(sink.last('midi/minilab3/last').id, 'knob1');
  assert.ok(!sink.names().includes('midi/cc/74'));
  assert.ok(!sink.names().includes('midi/virtual'));
  assert.deepEqual(seen, [['knob1', 100 / 127, 'hw']]);
  assert.deepEqual(c.groups().knob.slice(0, 2), [100 / 127, 0]);
});

test('a finger on the virtual knob: the same bytes, plus generic names and midi/virtual', () => {
  const sink = recorder();
  const c = new MidiController(P('minilab3'), { sink });
  const bytes = c.setValue('s2', 0.5);
  assert.deepEqual(bytes, [0xb0, 83, 64]);
  assert.equal(sink.last('midi/minilab3/s2/raw'), 64);
  assert.equal(sink.last('midi/cc/83'), 64 / 127);
  assert.equal(sink.last('midi/ch/1/cc/83'), 64 / 127);
  assert.deepEqual(sink.last('midi/virtual').data, [0xb0, 83, 64]);
  assert.equal(c.setValue('s2', 0.5), null, 'same raw value → nothing sent');
});

test('mirror (a phone / feedback) updates state and views, publishes nothing', () => {
  const sink = recorder();
  const c = new MidiController(P('lpd8'), { sink });
  let n = 0; c.onChange((id) => { if (id) n++; });
  c.ingest([0x99, 36, 90], { source: 'mirror' });
  assert.equal(sink.log.length, 0);
  assert.equal(c.get('pad1').held, true); assert.equal(n, 1);
});

test('pads: velocity while held, hit pulse, pressure, release', () => {
  const sink = recorder();
  const c = new MidiController(P('minilab3'), { sink });
  c.press('pad3', 0.5);
  assert.equal(sink.last('midi/minilab3/pad3'), 64 / 127);
  assert.deepEqual(sink.last('midi/minilab3/pad3/hit'), { vel: 64 / 127, velocity: 64, note: 38, ch: 10 });
  c.ingest([0xa9, 38, 100], { source: 'hw' });                 // poly aftertouch
  assert.equal(sink.last('midi/minilab3/pad3/pressure'), 100 / 127);
  c.release('pad3');
  assert.equal(sink.last('midi/minilab3/pad3'), 0);
  assert.deepEqual(sink.last('midi/note/off'), { note: 38, ch: 10, device: 'minilab3' });
});

test('keys: on/off pulses, n<note> while held, any note on the channel (octave shift)', () => {
  const sink = recorder();
  const c = new MidiController(P('minilab3'), { sink });
  c.ingest([0x90, 84, 80], { source: 'hw' });                  // above the 48–72 window: Oct+ on the hardware
  assert.deepEqual(sink.last('midi/minilab3/keys/on'), { note: 84, vel: 80 / 127, velocity: 80, ch: 1 });
  assert.equal(sink.last('midi/minilab3/n84'), 80 / 127);
  assert.ok(c.keys.has(84));
  c.ingest([0x80, 84, 0], { source: 'hw' });
  assert.equal(sink.last('midi/minilab3/n84'), 0); assert.equal(c.keys.size, 0);
});

test('pitch strip is bipolar and springs back', () => {
  const sink = recorder();
  const c = new MidiController(P('minilab3'), { sink });
  c.setValue('pitch', 1);
  assert.equal(sink.last('midi/minilab3/pitch'), 1);
  assert.equal(sink.last('midi/minilab3/pitch/raw'), 16383);
  c.rest('pitch');
  assert.equal(sink.last('midi/minilab3/pitch'), 0);
  assert.equal(sink.last('midi/bend'), 0);
});

test('relative encoder: position accumulates, delta is published, virtual turns send the same encoding', () => {
  const sink = recorder();
  const c = new MidiController(P('minilab3'), { sink });
  const p0 = c.get('enc').pos;
  c.ingest([0xb0, 28, 70], { source: 'hw' });                  // offset64: +6
  assert.equal(sink.last('midi/minilab3/enc/delta'), 6);
  assert.ok(Math.abs(c.get('enc').pos - (p0 + 0.06)) < 1e-9);
  const b = c.turn('enc', -3);
  assert.deepEqual(b, [0xb0, 28, 61]);
  assert.equal(sink.last('midi/minilab3/enc/delta'), -3);
});

test('toggle buttons (nanoKONTROL2 in toggle mode) and their LEDs', () => {
  const led = [];
  const p = structuredClone(P('nano2')); p.controls.find((c) => c.id === 's1').mode = 'toggle';
  const c = new MidiController(p, { sink: () => {}, onLed: (b) => led.push(b) });
  c.press('s1'); c.release('s1');
  assert.equal(c.get('s1').held, true, 'toggle stays on after release');
  c.press('s1');
  assert.equal(c.get('s1').held, false);
  assert.deepEqual(led, [[0xb0, 32, 127], [0xb0, 32, 0]]);
});

test('Launchpad LEDs: hit = the rack colour, release = its dim twin; snapshot lights the idle grid', () => {
  const led = [];
  const c = new MidiController(P('lpmini'), { sink: () => {}, onLed: (b) => led.push(b) });
  c.ingest([0x90, 84, 127], { source: 'hw' });
  c.ingest([0x80, 84, 0], { source: 'hw' });
  assert.deepEqual(led, [[0x90, 84, 21], [0x90, 84, 23]]);
  const snap = c.ledSnapshot();
  assert.equal(snap.filter((b) => (b[0] & 0xf0) === 0x90).length, 64);
  assert.deepEqual(snap.find((b) => b[1] === 36), [0x90, 36, 15]);
});

test('last carries the grid position (the TD tool\'s index / x / y)', () => {
  const sink = recorder();
  const c = new MidiController(P('lpmini'), { sink });
  c.ingest([0x90, 36, 100], { source: 'hw' });
  const last = sink.last('midi/lpmini/last');
  assert.deepEqual([last.id, last.section, last.row, last.col], ['pad1', 'grid', 7, 0]);
});

test('learn: the next hardware message binds; a taken message swaps', () => {
  const c = new MidiController(P('minilab3'), { sink: () => {} });
  c.learn('knob1');
  c.ingest([0xb0, 30, 10], { source: 'hw' });
  assert.equal(c.control('knob1').cc, 30);
  assert.equal(c.learning, null);
  c.learn('knob1');
  c.ingest([0xb0, 71, 10], { source: 'hw' });                  // knob2's CC
  assert.equal(c.control('knob1').cc, 71);
  assert.equal(c.control('knob2').cc, 30, 'knob2 took knob1\'s old message');
  const m = c.exportMapping();
  assert.deepEqual(Object.keys(m).sort(), ['knob1', 'knob2']);
  const d = new MidiController(P('minilab3'), { sink: () => {} });
  d.applyMapping(JSON.parse(JSON.stringify(m)));
  assert.equal(d.control('knob1').cc, 71);
  d.resetMapping(); assert.equal(d.control('knob1').cc, 74);
});

test('auto-learn: an unknown device fills a generic layout in the order you move it', () => {
  const sink = recorder();
  const c = new MidiController(P('generic-8k8p'), { sink });
  assert.equal(c.autoLearn, true);
  c.ingest([0xb3, 100, 5], { source: 'hw' });
  c.ingest([0xb3, 101, 5], { source: 'hw' });
  c.ingest([0x93, 60, 99], { source: 'hw' });
  assert.deepEqual([c.control('k1').cc, c.control('k1').ch, c.control('k2').cc], [100, 4, 101]);
  assert.deepEqual([c.control('pad1').note, c.control('pad1').ch], [60, 4]);
  assert.equal(sink.last('midi/g8k8p/k2'), 5 / 127);
  assert.equal(sink.last('midi/g8k8p/pad1'), 99 / 127);
});

test('profileSignals lists the namespace', () => {
  const names = profileSignals(normalizeProfile(P('minilab3')));
  for (const n of ['midi/minilab3/knob1', 'midi/minilab3/s4/raw', 'midi/minilab3/pad8/hit', 'midi/minilab3/enc/delta', 'midi/minilab3/keys/on', 'midi/minilab3/n48', 'midi/minilab3/last']) assert.ok(names.includes(n), n);
});

// ------------------------------------------------------------------ into a work: params
test('controllerRoutes: a knob drives a param through the Mapper; a pad fires a pulse param', () => {
  const signals = new Signals();
  const params = new Params([{ key: 'hue', min: 0, max: 360, def: 0 }, { key: 'burst', min: 0, max: 1, def: 0, pulse: true }]);
  const mapper = new Mapper({ signals, params });
  for (const r of controllerRoutes(P('minilab3'), { knob1: 'hue', pad1: { target: 'burst', on: 'hit' } })) mapper.addRoute(r);
  const c = new MidiController(P('minilab3'), { signals });
  let bursts = 0; params.onPulse('burst', () => bursts++);
  c.ingest([0xb0, 74, 127], { source: 'hw' });
  assert.equal(params.resolve().hue, 360);
  c.ingest([0x99, 36, 100], { source: 'hw' });
  assert.equal(bursts, 1);
});

// ------------------------------------------------------------------ hardware engine + manager (fake Web MIDI)
function fakePort(name, type = 'input') {
  return { id: name + '-' + type, name, type, state: 'connected', connection: 'open', manufacturer: 'fake', onmidimessage: null, sent: [], send(b) { this.sent.push(Array.from(b)); },
    play(bytes) { this.onmidimessage?.({ data: Uint8Array.from(bytes) }); } };
}
function fakeAccess(ins = [], outs = []) {
  const a = { inputs: new Map(ins.map((p) => [p.id, p])), outputs: new Map(outs.map((p) => [p.id, p])), onstatechange: null, sysexEnabled: false };
  a.plug = (p) => { (p.type === 'input' ? a.inputs : a.outputs).set(p.id, p); a.onstatechange?.({ port: p }); };
  a.unplug = (p) => { (p.type === 'input' ? a.inputs : a.outputs).delete(p.id); a.onstatechange?.({ port: p }); };
  return a;
}

test('Midi engine: injectable access, raw listeners, legacy + per-channel names', async () => {
  const signals = new Signals();
  const kb = fakePort('Minilab3 MIDI');
  const midi = new Midi({ signals, requestAccess: async () => fakeAccess([kb]) });
  const raw = []; midi.listen((d, port) => raw.push([Array.from(d), port.slug]));
  assert.equal(await midi.enable(), true);
  kb.play([0x99, 36, 127]);
  assert.deepEqual(raw, [[[0x99, 36, 127], 'minilab3-midi']]);
  assert.equal(signals.get('midi/note/on').note, 36);
  assert.equal(signals.get('midi/ch/10/note/36'), 1);
  kb.play([0xb0, 74, 0]);
  assert.equal(signals.get('midi/cc/74'), 0); assert.equal(signals.get('midi/ch/1/cc/74'), 0);
  const none = new Midi({ signals, requestAccess: async () => { throw new Error('denied'); } });
  assert.equal(await none.enable(), false);
});

test('MidiControllers: plug in → the matching on-screen device appears, moves, lights; unplug → stays virtual', async () => {
  const signals = new Signals();
  const store = new Map(); const storage = { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, String(v)) };
  const access = fakeAccess();
  const midi = new Midi({ signals, requestAccess: async () => access });
  const mcs = new MidiControllers({ profiles: PROFILES, signals, midi, initial: 'generic-keys25', storage });
  await midi.enable();
  assert.equal(mcs.current.id, 'generic-keys25');
  const lpIn = fakePort('LPMiniMK3 MIDI'), lpDaw = fakePort('LPMiniMK3 DAW'), lpOut = fakePort('LPMiniMK3 MIDI', 'output');
  access.plug(lpOut); access.plug(lpDaw); access.plug(lpIn);
  assert.equal(mcs.current.id, 'novation-launchpad-mini-mk3', 'switched to the plugged device');
  assert.equal(mcs.hardwareFor('novation-launchpad-mini-mk3'), 'LPMiniMK3 MIDI');
  assert.ok(lpOut.sent.length >= 64, 'idle LED snapshot sent');
  lpOut.sent.length = 0;
  lpIn.play([0x90, 99, 120]);
  assert.equal(signals.get('midi/lpmini/pad64'), 120 / 127);
  assert.deepEqual(lpOut.sent, [[0x90, 99, 21]]);
  lpDaw.play([0x90, 99, 120]);                                   // the DAW port is not routed
  assert.equal(mcs.devices().find((d) => d.name === 'LPMiniMK3 DAW').profileId, null);
  access.unplug(lpIn);
  assert.equal(mcs.hardwareFor('novation-launchpad-mini-mk3'), null);
  assert.equal(mcs.current.id, 'novation-launchpad-mini-mk3', 'the virtual one stays');
  // an unknown device, assigned by hand to a generic layout; the choice and the learned map persist
  const odd = fakePort('Weird Box'); access.plug(odd);
  const slug = mcs.devices().find((d) => d.name === 'Weird Box').slug;
  mcs.assign(slug, 'generic-8f');
  odd.play([0xb0, 9, 64]);
  assert.equal(signals.get('midi/g8f/f1'), 64 / 127);
  assert.match(store.get('openav.midi.assign'), /Weird Box/);
  assert.match(store.get('openav.midi.map.generic-8f'), /"cc":9/);
});

// ------------------------------------------------------------------ Web MIDI shim
test('virtual MIDIAccess: the sketch\'s own handler receives the bytes', () => {
  const v = createVirtualMIDIAccess({ name: 'Lab Virtual MIDI' });
  const got = [], got2 = [];
  for (const input of v.access.inputs.values()) input.onmidimessage = (m) => got.push(Array.from(m.data));
  [...v.access.inputs.values()][0].addEventListener('midimessage', (m) => got2.push(m.data[1]));
  v.emit([0x90, 60, 100]);
  assert.deepEqual(got, [[0x90, 60, 100]]); assert.deepEqual(got2, [60]);
  assert.equal([...v.access.inputs.values()][0].name, 'Lab Virtual MIDI');
  const out = []; const w = createVirtualMIDIAccess({ onOutput: (b) => out.push(b) });
  [...w.access.outputs.values()][0].send([0x90, 1, 2]);
  assert.deepEqual(out, [[0x90, 1, 2]]);
});

test('virtual MIDIAccess: hardware first, hot-plug fires statechange', async () => {
  const v = createVirtualMIDIAccess();
  const changes = []; v.access.onstatechange = (e) => changes.push(e.port.name);
  const real = new EventTarget(); real.inputs = new Map(); real.outputs = new Map();
  const kb = { id: 'kb', name: 'Keyboard', type: 'input', state: 'connected' };
  real.inputs.set('kb', kb);
  v.addReal(real);
  assert.deepEqual([...v.access.inputs.values()].map((p) => p.name), ['Keyboard', 'OAV Virtual MIDI']);
  assert.deepEqual(changes, ['Keyboard']);
  real.inputs.delete('kb'); real.dispatchEvent(new Event('statechange'));
  assert.deepEqual([...v.access.inputs.values()].map((p) => p.name), ['OAV Virtual MIDI']);
  assert.deepEqual(changes, ['Keyboard', 'Keyboard']);
});

test('virtualRequestMIDIAccess: refused, missing, slow and granted real access all resolve', async () => {
  const make = () => createVirtualMIDIAccess();
  const names = (a) => [...a.inputs.values()].map((p) => p.name);
  assert.deepEqual(names(await virtualRequestMIDIAccess({ real: null, make })()), ['OAV Virtual MIDI']);
  assert.deepEqual(names(await virtualRequestMIDIAccess({ real: async () => { throw new Error('denied'); }, make })()), ['OAV Virtual MIDI']);
  const t0 = Date.now();
  const slow = await virtualRequestMIDIAccess({ real: () => new Promise(() => {}), make, waitMs: 60 })();
  assert.ok(Date.now() - t0 < 1000); assert.deepEqual(names(slow), ['OAV Virtual MIDI']);
  const real = fakeAccess([fakePort('Minilab3 MIDI')]); real.addEventListener = () => {};
  assert.deepEqual(names(await virtualRequestMIDIAccess({ real: async () => real, make })()), ['Minilab3 MIDI', 'OAV Virtual MIDI']);
});

test('WebMidi.js-style use (iterate inputs, open(), onmidimessage) works on the virtual port', async () => {
  const v = createVirtualMIDIAccess();
  const access = await virtualRequestMIDIAccess({ real: null, make: () => v })({ sysex: false });
  const it = access.inputs.values(); const first = it.next();
  assert.equal(first.done, false);
  await first.value.open();
  assert.equal(first.value.connection, 'open');
  let ev = null; first.value.onmidimessage = (e) => { ev = e; };
  v.emit([0xe0, 0, 64]);
  assert.deepEqual(Array.from(ev.data), [0xe0, 0, 64]);
  assert.equal(typeof ev.timeStamp, 'number');
  await sleep(0);
});
