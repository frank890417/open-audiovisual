// A profile as files other software reads. The QLC+ side is checked against real .qxi files (tests/fixtures/qlc, Apache-2.0);
// the Mixxx side against the file format, with no Mixxx data in this repository (Mixxx is GPL, this project is MIT).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { PROFILES, profileById } from '../packages/midi/profiles/index.js';
import { toQxi, toMixxx, qlcChannel, mixxxBindings } from '../packages/midi/export.js';
import { parseQxi, decodeQlcNumber } from '../tools/qlc/qxi.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const fixture = (n) => fs.readFileSync(path.join(ROOT, 'tests/fixtures/qlc', n), 'utf8');
const DEVICES = PROFILES.filter((p) => p.kind === 'device');

/** Is this XML balanced? Enough to catch a broken generator; xmllint and the real apps were run by hand. */
function balanced(xml) {
  const stack = [];
  for (const m of xml.replace(/<!--[\s\S]*?-->/g, '').replace(/<\?[\s\S]*?\?>/g, '').replace(/<!DOCTYPE[^>]*>/g, '').matchAll(/<(\/?)([A-Za-z-]+)([^>]*?)(\/?)>/g)) {
    if (m[1]) { assert.equal(stack.pop(), m[2], `closing ${m[2]}`); } else if (!m[4]) stack.push(m[2]);
  }
  assert.deepEqual(stack, []);
}
const tags = (xml) => [...xml.replace(/<!--[\s\S]*?-->/g, '').matchAll(/<([A-Za-z]+)[\s>/]/g)].map((m) => m[1]);
/** The order top-level elements come in, repeats folded: what a reader of the format depends on. */
const shape = (xml) => tags(xml).filter((t) => ['Creator', 'Manufacturer', 'Model', 'Channel', 'ColorTable', 'MidiChannelTable'].includes(t)).filter((t, i, a) => t !== a[i - 1]);

test('qlcChannel numbers a message the way QLC+ does', () => {
  assert.equal(qlcChannel({ msg: 'cc', ch: 1, cc: 7 }, { omni: false }), 7);
  assert.equal(qlcChannel({ msg: 'cc', ch: 2, cc: 7 }), 4103, 'QLC+\'s APC40 mkII: Slider 2 is CC 7 on channel 2');
  assert.equal(qlcChannel({ msg: 'note', ch: 1, note: 36 }, { omni: false }), 164);
  assert.equal(qlcChannel({ msg: 'pitchbend', ch: 1 }, { omni: false }), 513);
  assert.equal(qlcChannel({ msg: 'chanat', ch: 1 }, { omni: false }), 512);
  for (const n of [7, 4103, 164, 513, 512]) { const d = decodeQlcNumber(n), back = qlcChannel({ ...d, ch: d.ch ?? 1 }, { omni: d.ch !== null }); assert.equal(back, n, String(n)); }
});

test('the parser reads the real files', () => {
  const a = parseQxi(fixture('Akai-APC40-mkII.qxi'));
  assert.equal(a.manufacturer, 'Akai'); assert.equal(a.model, 'APC40 mkII'); assert.equal(a.type, 'MIDI');
  assert.equal(a.channels.find((c) => c.number === 4103).name, 'Slider 2');
  assert.ok(a.colors.length > 50); assert.equal(a.colors[0].label, 'Off');
  assert.ok(a.midiChannels.length >= 1);
  assert.equal(a.channels.filter((c) => c.number === 0).length, 0, 'a MidiChannelTable row is not an input channel');
  const l = parseQxi(fixture('Novation-LaunchPadMiniMK3.qxi'));
  assert.equal(l.channels[0].feedback.upper, 6);
  assert.deepEqual(l.midiChannels.map((c) => c.label), ['Static colour', 'Flashing colour', 'Pulsing colour']);
});

test('a .qxi comes out in the shape of the real ones', () => {
  const real = shape(fixture('KORG-nanoKONTROL2.qxi')), ours = shape(toQxi(profileById('korg-nanokontrol2')));
  assert.deepEqual(ours, real);
  assert.deepEqual(shape(toQxi({ ...profileById('novation-launchpad-mini-mk3'), palette: { cite: { source: 0 }, channels: [{ ch: 1, name: 'Static' }], colors: [{ value: 5, name: 'Red', rgb: '#FF0000' }] } })), shape(fixture('Novation-LaunchPadMiniMK3.qxi')));
  for (const p of DEVICES) {
    const xml = toQxi(p);
    balanced(xml);
    assert.match(xml, /<InputProfile xmlns="http:\/\/www\.qlcplus\.org\/InputProfile">/);
    const q = parseQxi(xml);
    assert.equal(q.type, 'MIDI');
    assert.ok(q.channels.length >= p.controls.length - 1, p.id);
    assert.equal(new Set(q.channels.map((c) => c.number)).size, q.channels.length, `${p.id}: no number twice`);
    assert.deepEqual(q.channels.map((c) => c.number), [...q.channels].map((c) => c.number).sort((a, b) => a - b), `${p.id}: ascending, as QLC+ saves them`);
    for (const c of q.channels) assert.ok(['Slider', 'Knob', 'Encoder', 'Button'].includes(c.type), `${p.id} ${c.name}`);
  }
});

test('our numbers agree with QLC+ where both describe the same mode of the same device', () => {
  const nums = (xml) => new Set(parseQxi(xml).channels.map((c) => c.number));
  // nanoKONTROL2 in CC mode: QLC+ and this project read the same manual, so every number of theirs should be ours
  const theirs = nums(fixture('KORG-nanoKONTROL2.qxi')), ours = nums(toQxi(profileById('korg-nanokontrol2')));
  const missing = [...theirs].filter((n) => !ours.has(n));
  assert.deepEqual(missing, [], 'in QLC+ but not here');
  // APC40 mkII: the track faders are one channel per track in both
  const apc = nums(toQxi(profileById('akai-apc40-mk2'))), real = nums(fixture('Akai-APC40-mkII.qxi'));
  for (let t = 0; t < 8; t++) { const n = (t << 12) | 7; assert.ok(apc.has(n) && real.has(n), `fader ${t + 1}`); }
});

test('LED values and the palette survive', () => {
  const lp = parseQxi(toQxi(profileById('akai-apc-mini-mk2')));
  assert.ok(lp.channels.some((c) => c.feedback), 'a device with LEDs has feedback');
  const c = lp.channels.find((x) => x.feedback);
  assert.ok(c.feedback.upper <= 255 && c.feedback.lower <= 255);
  const withPal = { ...profileById('akai-lpd8'), palette: { cite: { source: 0 }, channels: [{ ch: 2, name: 'Flash' }], colors: [{ value: 5, name: 'Red & <hot>', rgb: '#FF0000' }] } };
  const x = toQxi(withPal), q = parseQxi(x);
  balanced(x);
  assert.deepEqual(q.colors, [{ value: 10, label: 'Red & <hot>', rgb: '#ff0000' }]);
  assert.deepEqual(q.midiChannels, [{ value: 1, label: 'Flash' }]);
  assert.match(toQxi(profileById('akai-lpd8')), /Omni/, 'a device on channel 10 says how to set the input up');
  assert.doesNotMatch(toQxi(profileById('korg-nanokontrol2')), /Omni/);
});

// ------------------------------------------------------------------ Mixxx
const need = ['group', 'key', 'status', 'midino', 'options'];

test('every device gives a mapping with the structure Mixxx reads', () => {
  for (const p of DEVICES) {
    const m = toMixxx(p);
    balanced(m.xml);
    assert.match(m.xml, /<MixxxControllerPreset mixxxVersion="2\.4\+" schemaVersion="1">/, p.id);
    assert.deepEqual(['info', 'controller', 'scriptfiles', 'controls', 'outputs'].map((t) => m.xml.includes(`<${t}`)), [true, true, true, true, true], p.id);
    assert.ok(m.xml.indexOf('<scriptfiles>') < m.xml.indexOf('<controls>') && m.xml.indexOf('<controls>') < m.xml.indexOf('<outputs>'), p.id);
    assert.ok(m.xml.includes(`filename="${m.jsName}"`), p.id);
    for (const c of m.xml.matchAll(/<control>([\s\S]*?)<\/control>/g)) {
      for (const t of need) assert.ok(c[1].includes(`<${t}>`), `${p.id}: <control> has <${t}>`);
      assert.match(c[1], /<status>0x[0-9A-F]{2}<\/status>/); assert.match(c[1], /<midino>0x[0-9A-F]{2}<\/midino>/);
    }
    for (const o of m.xml.matchAll(/<output>([\s\S]*?)<\/output>/g)) for (const t of ['group', 'key', 'status', 'midino', 'on', 'off', 'minimum', 'maximum']) assert.ok(o[1].includes(`<${t}>`), `${p.id}: <output> has <${t}>`);
    assert.doesNotThrow(() => new Function(m.js), `${p.id}: the script parses`);
  }
});

test('bindings: messages are the profile\'s, no message twice, keys and pitch bend left out', () => {
  for (const p of DEVICES) {
    const b = mixxxBindings(p);
    assert.equal(new Set(b.map((x) => x.control.id)).size, b.length, p.id);
    assert.ok(!b.some((x) => x.control.type === 'keys' || x.control.msg === 'pitchbend'), p.id);
    for (const x of b) assert.match(x.group, /^\[[A-Za-z0-9_[\]]+\]$/, p.id);
  }
  const lpd8 = mixxxBindings(profileById('akai-lpd8'));
  assert.ok(lpd8.some((x) => x.key === 'hotcue_1_activate' && x.group === '[Channel1]'));
  assert.ok(lpd8.some((x) => x.key === 'hotcue_1_activate' && x.group === '[Channel2]'));
});

test('the script sets the device up, says goodbye, and reads relative encoders', () => {
  const run = (id) => {
    const m = toMixxx(profileById(id)), sent = [], values = {};
    const prefix = /var (OAV_\w+) = \{\};/.exec(m.js)[1];
    const midi = { sendSysexMsg: (b, n) => { assert.equal(b.length, n); sent.push(b); } };
    const engine = { setValue: (g, k, v) => { values[`${g}${k}`] = v; }, getParameter: () => 0.5, setParameter: (g, k, v) => { values[`${g}${k}`] = v; } };
    const o = new Function('midi', 'engine', m.js + `; return ${prefix};`)(midi, engine);
    return { o, sent, values };
  };
  const lp = run('novation-launchpad-pro-mk3');
  lp.o.init('x', false); assert.deepEqual(lp.sent, [[0xf0, 0, 0x20, 0x29, 2, 0x0e, 0x0e, 1, 0xf7]]);
  lp.o.shutdown(); assert.deepEqual(lp.sent[1], [0xf0, 0, 0x20, 0x29, 2, 0x0e, 0x0e, 0, 0xf7], 'back to Live mode when Mixxx lets go');
  const plain = run('akai-lpd8'); plain.o.init('x', false); assert.deepEqual(plain.sent, [], 'no SysEx in the profile: none sent');
  const apc = run('akai-apc40-mk2');
  const [first] = Object.entries(apc.o.encoders);
  const [status, control] = first[0].split(':').map(Number);
  apc.o.turn(0, control, 127, status, '[Master]');
  assert.equal(apc.values['[Library]MoveVertical'], -1, 'two\'s complement: 127 is one step back');
});

test('the command line writes the files, and refuses what it cannot find', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'oav-export-'));
  const cli = (...a) => execFileSync('node', ['tools/export-controller.mjs', ...a], { cwd: ROOT, encoding: 'utf8' });
  cli('akai-lpd8', '--out', dir);
  assert.deepEqual(fs.readdirSync(dir).sort(), ['akai-lpd8.midi.xml', 'akai-lpd8.qxi', 'akai-lpd8.scripts.js']);
  assert.equal(fs.readFileSync(path.join(dir, 'akai-lpd8.qxi'), 'utf8'), toQxi(profileById('akai-lpd8')));
  const one = fs.mkdtempSync(path.join(os.tmpdir(), 'oav-export-'));
  cli(path.join(ROOT, 'packages/midi/profiles/korg-nanokey2.json'), '--to', 'qxi', '--out', one);
  assert.deepEqual(fs.readdirSync(one), ['korg-nanokey2.qxi']);
  assert.throws(() => execFileSync('node', ['tools/export-controller.mjs', 'nope'], { cwd: ROOT, stdio: 'pipe' }));
  fs.rmSync(dir, { recursive: true }); fs.rmSync(one, { recursive: true });
});

test('every device page offers the files, and they are the ones this code makes', () => {
  for (const p of DEVICES) for (const [lang, base] of [['en', ''], ['zh', 'zh/']]) {
    const page = fs.readFileSync(path.join(ROOT, `${base}controllers/${p.id}/index.html`), 'utf8');
    for (const f of [`${p.id}.qxi`, `${p.id}.midi.xml`, `${p.id}.scripts.js`]) assert.ok(page.includes(f), `${lang} ${p.id}: ${f}`);
  }
  for (const p of DEVICES) {
    const dir = path.join(ROOT, 'controllers', p.id), m = toMixxx(p);
    assert.equal(fs.readFileSync(path.join(dir, `${p.id}.qxi`), 'utf8'), toQxi(p), p.id);
    assert.equal(fs.readFileSync(path.join(dir, m.xmlName), 'utf8'), m.xml, p.id);
    assert.equal(fs.readFileSync(path.join(dir, m.jsName), 'utf8'), m.js, p.id);
  }
});
