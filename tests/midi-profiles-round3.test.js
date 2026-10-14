// Round 3 of the controller profiles: Novation Launchpad Pro MK3 (Programmer mode),
// DJ TechTools Midi Fighter Twister (factory, bank 1), AKAI APC40 mkII (Generic mode).
// Every number below is from the manufacturer's document named in the profile's sources;
// the port tests keep each one from grabbing a sibling model's port.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateProfile, normalizeProfile, matchProfile, pickPort } from '../packages/midi/profiles.js';
import { MidiController } from '../packages/midi/controller.js';
import { PROFILES, profileById } from '../packages/midi/profiles/index.js';

const IDS = ['novation-launchpad-pro-mk3', 'djtechtools-midi-fighter-twister', 'akai-apc40-mk2'];
const recorder = () => { const log = []; const sink = (n, v, i) => log.push([n, v, i]); sink.last = (n) => [...log].reverse().find((x) => x[0] === n)?.[1]; return sink; };
const ctl = (id, extra = {}) => new MidiController(profileById(id), { sink: () => {}, ...extra });

test('the three profiles are shipped, valid, cited, and named by their signal namespace', () => {
  for (const id of IDS) {
    const p = profileById(id);
    assert.ok(p, id + ' is registered');
    assert.deepEqual(validateProfile(p), [], id);
    assert.equal(p.kind, 'device');
    assert.ok(p.sources.every((s) => s.title) && p.sources.some((s) => /^https:\/\//.test(s.url || '')), id + ' cites a link');
    assert.ok(p.notes && p.notes.length > 200, id + ' says which mode it models');
  }
  assert.equal(profileById('lppro3').id, IDS[0]);
  assert.equal(profileById('twister').id, IDS[1]);
  assert.equal(profileById('apc40mk2').id, IDS[2]);
  assert.equal(new Set(PROFILES.map((p) => p.short)).size, PROFILES.length);
});

test('community sources are labelled non-official; a control without a document is flagged', () => {
  for (const id of IDS) for (const s of profileById(id).sources) if (/github|forum|google\.com\/g\//.test(s.url || '')) assert.match(s.title, /non-official/, `${id}: ${s.title}`);
  const tw = profileById(IDS[1]);
  assert.deepEqual(tw.controls.filter((c) => c.verified === false).map((c) => c.id), ['sidel1', 'sidel2', 'sidel3', 'sider1', 'sider2', 'sider3']);
  for (const c of tw.controls.filter((c) => c.verified === false)) assert.equal(typeof c.note, 'string', c.id + ' says why');
  const apc = profileById(IDS[2]);
  assert.equal(apc.controls.filter((c) => c.verified === false).length, 40, 'the 40 clip pads (which pad is which is not printed)');
});

// ------------------------------------------------------------------ ports
const WHO = (name) => matchProfile(name, PROFILES)?.profile.id ?? null;
test('Launchpad Pro MK3 ports: the MIDI port wins, DAW / DIN do not, no sibling is taken', () => {
  for (const n of ['LPProMK3 MIDI', 'LPProMK3 MIDI In', 'LPProMK3 MIDI Out', 'Launchpad Pro MK3 (LPProMK3 MIDI)', 'LPProMK3 MIDI (MIDI 1)', 'Launchpad Pro [MK3] MIDI']) assert.equal(WHO(n), IDS[0], n);
  for (const n of ['LPProMK3 DAW', 'LPProMK3 DAW Out', 'LPProMK3 DIN', 'LPProMK3 DIN Out', 'MIDIIN2 (LPProMK3 MIDI)', 'MIDIIN3 (LPProMK3 MIDI)', 'MIDIOUT2 (LPProMK3 MIDI)']) assert.equal(WHO(n), null, n);
  // the other Launchpads and Novation gear keep their own, or none
  assert.equal(WHO('LPMiniMK3 MIDI'), 'novation-launchpad-mini-mk3');
  assert.equal(WHO('Launchpad Mini MK3 LPMiniMK3 MIDI'), 'novation-launchpad-mini-mk3');
  for (const n of ['Launchpad Pro', 'Launchpad Pro Standalone Port', 'Launchpad Pro Live Port', 'Launchpad MK2', 'Launchpad X LPX MIDI', 'LPX MIDI', 'Launchpad S', 'Launchpad Pro MIDI 1']) assert.equal(WHO(n), null, n + ' (older Launchpads are not modelled)');
  assert.equal(WHO('Launchkey MK4 37 MIDI'), 'novation-launchkey-37-mk4');
  const ports = [{ name: 'LPProMK3 DAW Out' }, { name: 'LPProMK3 DIN Out' }, { name: 'LPProMK3 MIDI Out' }];
  assert.equal(pickPort(ports, normalizeProfile(profileById(IDS[0]))).name, 'LPProMK3 MIDI Out');
});

test('Midi Fighter Twister ports: only the Twister, not the other Midi Fighters', () => {
  for (const n of ['Midi Fighter Twister', 'Midi Fighter Twister 1', 'MIDIIN2 (Midi Fighter Twister)', 'midi fighter twister']) assert.equal(WHO(n), IDS[1], n);
  for (const n of ['Midi Fighter Spectra', 'Midi Fighter 64', 'Midi Fighter Classic', 'Midi Fighter 3D', 'Midi Fighter Pro', 'Midi Fighter Utility', 'Midi Fighter Twister Bootloader']) assert.equal(WHO(n), null, n);
});

test('APC40 mkII ports: not the old APC40, not the APC mini', () => {
  for (const n of ['APC40 mkII', 'APC40 mkII 1', 'Akai APC40 mkII', 'APC40 mk2', 'MIDIIN2 (APC40 mkII)', 'APC40 MKII']) assert.equal(WHO(n), IDS[2], n);
  for (const n of ['APC40', 'Akai APC40', 'APC40 1', 'APC20', 'APC Key 25', 'APC MINI', 'APC mini']) assert.equal(WHO(n), null, n);
  assert.equal(WHO('APC mini mk2 Control'), 'akai-apc-mini-mk2');
  assert.equal(WHO('APC mini mk2'), 'akai-apc-mini-mk2');
});

// ------------------------------------------------------------------ Launchpad Pro MK3
test('Launchpad Pro MK3 Programmer-mode map: pads 11–88, buttons are CCs', () => {
  const p = profileById(IDS[0]);
  const by = (id) => p.controls.find((c) => c.id === id);
  assert.equal(p.controls.filter((c) => c.type === 'pad').length, 64);
  assert.equal(p.controls.filter((c) => c.type === 'button').length, 41);   // 8 + 8 + 8 + 8 + 8 + shift
  assert.deepEqual([by('pad1').note, by('pad8').note, by('pad9').note, by('pad57').note, by('pad64').note], [11, 18, 21, 81, 88]);
  const grid = p.sections.find((s) => s.id === 'grid').controls;
  assert.equal(by(grid[0]).note, 81, 'top-left');
  assert.equal(by(grid[7]).note, 88, 'top-right');
  assert.equal(by(grid[56]).note, 11, 'bottom-left');
  assert.deepEqual(p.sections.find((s) => s.id === 'nav').controls.map((id) => by(id).cc), [91, 92, 93, 94, 95, 96, 97, 98]);
  assert.equal(by('shift').cc, 90);
  assert.deepEqual(p.sections.find((s) => s.id === 'left').controls.map((id) => by(id).cc), [80, 70, 60, 50, 40, 30, 20, 10]);
  assert.deepEqual(p.sections.find((s) => s.id === 'right').controls.map((id) => by(id).cc), [89, 79, 69, 59, 49, 39, 29, 19]);
  assert.deepEqual(p.sections.find((s) => s.id === 'select').controls.map((id) => by(id).cc), [101, 102, 103, 104, 105, 106, 107, 108]);
  assert.deepEqual(p.sections.find((s) => s.id === 'track').controls.map((id) => by(id).cc), [1, 2, 3, 4, 5, 6, 7, 8]);
  assert.ok(p.controls.every((c) => (c.ch ?? p.channel) === 1));
});

test('Launchpad Pro MK3 plays and lights: a hardware note becomes pad1, LEDs use the static channel and the palette', () => {
  const sink = recorder(), led = [];
  const c = new MidiController(profileById(IDS[0]), { sink, onLed: (b) => led.push(b) });
  c.ingest([0x90, 88, 127], { source: 'hw' });
  assert.equal(sink.last('midi/lppro3/pad64'), 1);
  c.ingest([0xb0, 91, 127], { source: 'hw' });
  assert.equal(sink.last('midi/lppro3/prev'), 1);
  c.ingest([0xb0, 101, 127], { source: 'hw' });
  assert.equal(sink.last('midi/lppro3/sel1'), 1);
  c.ingest([0x80, 88, 0], { source: 'hw' });
  assert.deepEqual(led.slice(0, 3), [[0x90, 88, 37], [0xb0, 91, 3], [0xb0, 101, 3]]);   // turquoise pad, white buttons: palette 37 / 3
  assert.deepEqual(led[3], [0x90, 88, 0]);
});

// ------------------------------------------------------------------ Midi Fighter Twister
test('Twister factory bank 1: encoders CC 0–15 ch 1 (absolute), pushes CC 0–15 ch 2, side buttons ch 4 CC 8–13', () => {
  const p = profileById(IDS[1]);
  const encs = p.controls.filter((c) => c.type === 'encoder'), pushes = p.controls.filter((c) => c.id.startsWith('push')), side = p.controls.filter((c) => c.id.startsWith('side'));
  assert.equal(encs.length, 16); assert.equal(pushes.length, 16); assert.equal(side.length, 6);
  assert.deepEqual(encs.map((c) => c.cc), [...Array(16).keys()]);
  assert.deepEqual(pushes.map((c) => c.cc), [...Array(16).keys()]);
  assert.ok(encs.every((c) => c.ch === 1 && c.relative === false), 'absolute on channel 1');
  assert.ok(pushes.every((c) => c.ch === 2 && c.msg === 'cc'), 'the switches default to CC on channel 2');
  assert.deepEqual(side.map((c) => [c.ch, c.cc]), [[4, 8], [4, 9], [4, 10], [4, 11], [4, 12], [4, 13]]);
  // the grid reads like the unit: encoder 1 top-left, 16 bottom-right
  const at = (id) => p.sections.find((s) => s.id === id);
  assert.ok(at('enc1').x < at('enc4').x && at('enc1').y === at('enc4').y && at('enc13').y > at('enc1').y && at('enc16').x === at('enc4').x);
});

test('Twister signals: an absolute encoder, a held push, the RGB LED, and the relative reading', () => {
  const sink = recorder(), led = [];
  const c = new MidiController(profileById(IDS[1]), { sink, onLed: (b) => led.push(b) });
  c.ingest([0xb0, 5, 64], { source: 'hw' });
  assert.equal(sink.last('midi/twister/enc6'), 64 / 127);
  c.ingest([0xb1, 5, 127], { source: 'hw' });
  assert.equal(sink.last('midi/twister/push6'), 1);
  c.ingest([0xb1, 5, 0], { source: 'hw' });
  assert.equal(sink.last('midi/twister/push6'), 0);
  assert.deepEqual(led, [[0xb1, 5, 127], [0xb1, 5, 0]], 'the RGB segment: same CC, channel 2, 127 active / 0 inactive');
  // the manual's 'Enc 3FH/41H' mode: 65 = one step clockwise, 63 = one step the other way
  const r = profileById(IDS[1]).controls.find((x) => x.id === 'enc1');
  const rel = new MidiController({ ...profileById(IDS[1]), controls: profileById(IDS[1]).controls.map((x) => (x.id === 'enc1' ? { ...r, relative: 'offset64' } : x)) }, { sink });
  rel.ingest([0xb0, 0, 65], { source: 'hw' });
  assert.equal(sink.last('midi/twister/enc1/delta'), 1);
  rel.ingest([0xb0, 0, 63], { source: 'hw' });
  assert.equal(sink.last('midi/twister/enc1/delta'), -1);
});

// ------------------------------------------------------------------ APC40 mkII
test('APC40 mkII Generic mode: the protocol document\'s numbers, one channel per track', () => {
  const p = profileById(IDS[2]);
  const by = (id) => p.controls.find((c) => c.id === id);
  const eq = (id, msg, num, ch = 1) => { const c = by(id); assert.ok(c, id); assert.equal(c.msg, msg, id); assert.equal(c[msg === 'cc' ? 'cc' : 'note'], num, id); assert.equal(c.ch ?? p.channel, ch, id + ' channel'); };
  assert.equal(p.controls.filter((c) => c.type === 'pad').length, 40);
  assert.deepEqual([by('pad1').note, by('pad40').note], [0, 39]);
  for (let t = 1; t <= 8; t++) { eq(`fader${t}`, 'cc', 7, t); eq(`stop${t}`, 'note', 0x34, t); eq(`arm${t}`, 'note', 0x30, t); eq(`solo${t}`, 'note', 0x31, t); eq(`act${t}`, 'note', 0x32, t); eq(`ab${t}`, 'note', 0x42, t); eq(`tk${t}`, 'cc', 0x2f + t); eq(`dk${t}`, 'cc', 0x0f + t); }
  eq('master', 'cc', 0x0e); eq('xfade', 'cc', 0x0f); eq('footswitch', 'cc', 0x40);
  for (let s = 1; s <= 5; s++) eq(`scene${s}`, 'note', 0x51 + s);
  eq('stopall', 'note', 0x51); eq('devl', 'note', 0x3a); eq('devr', 'note', 0x3b); eq('bankl', 'note', 0x3c); eq('bankr', 'note', 0x3d);
  eq('devon', 'note', 0x3e); eq('devlock', 'note', 0x3f); eq('clipview', 'note', 0x40); eq('detail', 'note', 0x41);
  eq('pan', 'note', 0x57); eq('sends', 'note', 0x58); eq('user', 'note', 0x59); eq('metro', 'note', 0x5a); eq('play', 'note', 0x5b); eq('rec', 'note', 0x5d);
  eq('up', 'note', 0x5e); eq('down', 'note', 0x5f); eq('right', 'note', 0x60); eq('left', 'note', 0x61); eq('shift', 'note', 0x62); eq('tap', 'note', 0x63);
  eq('nudgem', 'note', 0x64); eq('nudgep', 'note', 0x65); eq('sessrec', 'note', 0x66); eq('banklock', 'note', 0x67);
  for (const id of ['cue', 'tempo']) { assert.equal(by(id).type, 'encoder'); assert.equal(by(id).relative, 'twos'); }
  eq('cue', 'cc', 0x2f); eq('tempo', 'cc', 0x0d);
});

test('APC40 mkII signals: a fader per channel, the relative knobs, and the lit clip pad', () => {
  const sink = recorder(), led = [];
  const c = new MidiController(profileById(IDS[2]), { sink, onLed: (b) => led.push(b) });
  c.ingest([0xb2, 7, 127], { source: 'hw' });                 // channel 3, CC 7 = track 3's fader
  assert.equal(sink.last('midi/apc40mk2/fader3'), 1);
  c.ingest([0xb7, 7, 0], { source: 'hw' });
  assert.equal(sink.last('midi/apc40mk2/fader8'), 0);
  c.ingest([0xb0, 0x2f, 1], { source: 'hw' });                // the cue knob: 1 = +1, 127 = −1
  assert.equal(sink.last('midi/apc40mk2/cue/delta'), 1);
  c.ingest([0xb0, 0x2f, 127], { source: 'hw' });
  assert.equal(sink.last('midi/apc40mk2/cue/delta'), -1);
  c.ingest([0x90, 0x52, 127], { source: 'hw' });              // scene launch 1
  assert.equal(sink.last('midi/apc40mk2/scene1'), 1);
  c.ingest([0x93, 0x34, 127], { source: 'hw' });              // clip stop, track 4
  assert.equal(sink.last('midi/apc40mk2/stop4'), 1);
  c.ingest([0x90, 0, 127], { source: 'hw' });
  assert.deepEqual(led.at(-1), [0x90, 0, 37], 'clip launch 1 lights in the primary-colour channel, palette 37');
});

test('every control of the three is on the faceplate and in the stacked (portrait) layout', () => {
  for (const id of IDS) {
    const n = normalizeProfile(profileById(id));
    const shown = new Set(n.sections.flatMap((s) => s.controls)), stacked = new Set(n.portrait.flatMap((s) => s.controls));
    assert.equal(shown.size, n.controls.length, id + ' faceplate');
    assert.equal(stacked.size, n.controls.length, id + ' portrait');
  }
});
