// @openav/dmx — the universe, fixture profiles, the colour split and the patch: pure logic, no light, no socket.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as DMX from '../packages/dmx/index.js';
import { Universe, Universes } from '../packages/dmx/universe.js';
import { validateFixture, loadFixture } from '../packages/dmx/fixture.js';
import { rgbToChannels } from '../packages/dmx/color.js';
import { Patch } from '../packages/dmx/patch.js';
import { FIXTURES, fixtureById } from '../packages/dmx/fixtures/index.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PKG = path.join(ROOT, 'packages/dmx');
const near = (a, b, eps = 1e-9) => Math.abs(a - b) <= eps;
const bytesAt = (U, u, from, n) => [...U.bytes(u).slice(from - 1, from - 1 + n)];

// ---------------------------------------------------------------------------- the package itself
test('package: the public surface is small and every file runs in a browser as well as in Node', () => {
  assert.deepEqual(Object.keys(DMX).sort(), ['DmxEngine', 'FIXTURES', 'Patch', 'Universe', 'Universes', 'decodeArtDmx', 'decodeEnttecDmx', 'decodeSacn',
    'encodeArtDmx', 'encodeEnttecDmx', 'encodeSacn', 'fixtureById', 'loadFixture', 'rgbToChannels', 'sacnAddress', 'validateFixture']);
  const files = [];
  const walk = (d) => { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name); if (e.isDirectory()) walk(p); else if (/\.js$/.test(e.name)) files.push(p); } };   // reference.mjs is documentation, read by Node
  walk(PKG);
  assert.ok(files.length >= 9);
  for (const f of files) {
    const src = fs.readFileSync(f, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`\\])\/\/.*$/gm, '$1');
    const at = path.relative(ROOT, f);
    assert.doesNotMatch(src, /from\s+['"]node:|import\(\s*['"]node:|\brequire\(/, `${at}: no Node imports`);
    assert.doesNotMatch(src, /\bBuffer\b|\bprocess\.|\bimport\s*\.\s*meta\b/, `${at}: no Buffer, process or import.meta`);
    assert.doesNotMatch(src, /assert\s*\{\s*type/, `${at}: JSON import attributes are written "with", never "assert"`);
    assert.doesNotMatch(src, /Math\.random|Date\.now|performance\.now/, `${at}: nothing random, no clock (the engine is a function of time)`);
  }
  const pj = JSON.parse(fs.readFileSync(path.join(PKG, 'package.json'), 'utf8'));
  assert.equal(pj.name, '@openav/dmx'); assert.equal(pj.version, '0.1.0'); assert.equal(pj.license, 'MIT');
  assert.ok(!pj.dependencies, 'no dependencies');
});

// ---------------------------------------------------------------------------- universe
test('universe: 512 slots addressed 1..512; a wrong address or value is an error, not a clamp', () => {
  const u = new Universe(3);
  assert.equal(u.id, 3); assert.equal(u.data.length, 512);
  u.set(1, 10).set(512, 255);
  assert.equal(u.get(1), 10); assert.equal(u.get(512), 255); assert.equal(u.data[0], 10); assert.equal(u.data[511], 255);
  for (const a of [0, 513, 1.5, -1, '1', NaN]) assert.throws(() => u.get(a), RangeError, `address ${a}`);
  for (const v of [-1, 256, 1.5, NaN, '3']) assert.throws(() => u.set(5, v), RangeError, `value ${v}`);
  u.write(510, [1, 2, 3]);
  assert.deepEqual([...u.data.slice(509)], [1, 2, 3]);
  assert.throws(() => u.write(511, [1, 2, 3]), /past 512/);
  assert.throws(() => u.write(1, [0, 300]), RangeError);
  const c = u.copy(); c.set(1, 99);
  assert.equal(u.get(1), 10, 'a copy shares nothing');
  assert.equal(u.fill(7).get(300), 7);
  assert.throws(() => new Universe(-1), RangeError); assert.throws(() => new Universe(64000), RangeError);
  assert.equal(new Universe(0).id, 0, 'Art-Net counts from 0');
});

test('universes: made on first use, listed lowest first, bytes() is a copy and zeros for one never made', () => {
  const U = new Universes();
  U.get(5).set(1, 1); U.get(2).set(2, 2);
  assert.deepEqual(U.ids(), [2, 5]);
  assert.ok(U.has(5) && !U.has(1));
  const b = U.bytes(5); b[0] = 200;
  assert.equal(U.get(5).get(1), 1, 'bytes() is a copy');
  assert.equal(U.bytes(9).length, 512); assert.ok(U.bytes(9).every((x) => x === 0));
  assert.deepEqual(U.entries().map(([id, u]) => [id, u.id]), [[2, 2], [5, 5]]);
});

// ---------------------------------------------------------------------------- fixture profiles
const good = () => ({
  format: 'open-audiovisual/fixture@1', id: 'test-par', manufacturer: 'Test', name: 'Par', kind: 'par',
  modes: [{ id: '7ch', channels: ['dimmer', 'red', 'green', 'blue', 'strobe', 'pan', 'panFine'] }, { id: '3ch', channels: ['red', 'green', 'blue'] }],
  channels: {
    dimmer: { type: 'intensity' }, red: { type: 'color', color: 'red' }, green: { type: 'color', color: 'green' }, blue: { type: 'color', color: 'blue' },
    strobe: { type: 'strobe', ranges: [{ from: 0, to: 9, is: 'open' }, { from: 10, to: 255, is: 'strobe', hz: [1, 20] }] },
    pan: { type: 'pan', default: 128 }, panFine: { fineOf: 'pan' },
  },
  license: 'MIT', verified: false, verifications: [],
});

test('fixture: every shipped profile is valid, generic, MIT and unverified; the schema file is JSON', () => {
  assert.deepEqual(FIXTURES.map((f) => f.id), ['generic-dimmer', 'generic-rgb', 'generic-rgbw', 'generic-rgba', 'generic-rgbaw-uv', 'generic-strobe', 'generic-moving-head']);
  for (const f of FIXTURES) {
    assert.deepEqual(validateFixture(f), [], f.id);
    assert.equal(f.license, 'MIT', f.id); assert.equal(f.verified, false, f.id); assert.deepEqual(f.verifications, [], f.id);
    assert.ok(f.sources.length && f.sources[0].note, `${f.id}: says it is a generic layout`);
  }
  assert.equal(fixtureById('generic-rgbw').name, 'RGBW par'); assert.equal(fixtureById('nope'), null);
  const files = fs.readdirSync(path.join(PKG, 'fixtures')).filter((f) => /^generic-.*\.json$/.test(f)).map((f) => f.replace(/\.json$/, '')).sort();
  assert.deepEqual(files, FIXTURES.map((f) => f.id).sort(), 'every profile file is listed in fixtures/index.js');
  const schema = JSON.parse(fs.readFileSync(path.join(PKG, 'fixtures/fixture.schema.json'), 'utf8'));
  assert.equal(schema.properties.format.const, 'open-audiovisual/fixture@1');
  // the 16-channel moving head: 16-bit pan and tilt, and its program and reset are control channels
  const mh = loadFixture(fixtureById('generic-moving-head'));
  const m16 = mh.modes.find((m) => m.id === '16ch');
  assert.equal(m16.footprint, 16);
  assert.equal(m16.slots.find((s) => s.key === 'pan').fineOffset, 1);
  assert.equal(m16.slots.find((s) => s.key === 'tilt').fineOffset, 3);
  assert.deepEqual(m16.slots.filter((s) => s.type === 'control').map((s) => s.key), ['program', 'reset']);
  assert.equal(mh.modes.find((m) => m.id === '8ch').footprint, 8);
});

test('fixture: a bad profile says what is wrong, one sentence per problem', () => {
  assert.deepEqual(validateFixture(good()), []);
  const bad = (change, re) => { const p = good(); change(p); const probs = validateFixture(p); assert.ok(probs.some((x) => re.test(x)), `${re} in ${JSON.stringify(probs)}`); };
  bad((p) => { p.format = 'x'; }, /format/);
  bad((p) => { p.id = 'Bad Id'; }, /id:/);
  bad((p) => { p.kind = 'lamp'; }, /kind/);
  bad((p) => { p.modes[1].channels.push('nope'); }, /"nope" is not in channels/);
  bad((p) => { p.modes[1].channels.push('red'); }, /appears twice/);
  bad((p) => { p.modes[1].channels.push('panFine'); }, /fine byte of "pan", which this mode does not have/);
  bad((p) => { p.channels.panFine = { fineOf: 'nothing' }; }, /fineOf "nothing" is not a channel/);
  bad((p) => { p.channels.x = { fineOf: 'panFine' }; }, /itself a fine channel/);
  bad((p) => { p.channels.red.color = 'pink'; }, /color is one of/);
  bad((p) => { p.channels.dimmer.type = 'brightness'; }, /type is one of/);
  bad((p) => { p.channels.dimmer.default = 300; }, /default is 0–255/);
  bad((p) => { p.channels.strobe.ranges[1].from = 5; }, /do not overlap/);
  bad((p) => { p.channels.strobe.ranges[0].hz = [1, 2]; }, /only a strobe range has hz/);
  bad((p) => { p.channels.strobe.ranges[1].hz = [20, 1]; }, /hz is \[slowest, fastest\]/);
  bad((p) => { p.modes.push({ id: '3ch', channels: ['red'] }); }, /used twice/);
  bad((p) => { p.verified = true; }, /needs a verification with method "hardware"/);
  bad((p) => { p.verified = true; p.verifications = [{ date: '2026-11-24', by: 'a test', method: 'simulated' }]; }, /needs a verification with method "hardware"/);
  const ok = good(); ok.verified = true; ok.verifications = [{ date: '2026-11-24', by: 'someone with the par', method: 'hardware' }];
  assert.deepEqual(validateFixture(ok), [], 'a hardware verification is what verified: true needs');
  assert.throws(() => loadFixture({ ...good(), modes: [] }), (e) => /not valid/.test(e.message) && Array.isArray(e.problems));
  const f = loadFixture(good());
  assert.equal(loadFixture(f), f, 'loading a loaded fixture changes nothing');
});

// ---------------------------------------------------------------------------- colour
test('colour: white takes what r, g and b share; amber takes red and half as much green; CMY is subtractive', () => {
  const RGBW = ['red', 'green', 'blue', 'white'];
  assert.deepEqual(rgbToChannels([1, 1, 1], RGBW), { red: 0, green: 0, blue: 0, white: 1 }, 'white is the white LED alone');
  const warm = rgbToChannels([1, 0.6, 0.2], RGBW);
  assert.ok(near(warm.red, 0.8) && near(warm.green, 0.4) && warm.blue === 0 && near(warm.white, 0.2), JSON.stringify(warm));
  assert.deepEqual(rgbToChannels([1, 0, 0], ['red', 'green', 'blue']), { red: 1, green: 0, blue: 0 });
  assert.deepEqual(rgbToChannels([1, 0.5, 0], ['red', 'green', 'blue', 'amber']), { red: 0, green: 0, blue: 0, amber: 1 }, 'pure amber is the amber LED');
  const o = rgbToChannels([1, 0.25, 0], ['red', 'green', 'blue', 'amber']);
  assert.ok(near(o.amber, 0.5) && near(o.red, 0.5) && near(o.green, 0) && o.blue === 0, JSON.stringify(o));
  const p = rgbToChannels([1, 0.8, 0.6], ['red', 'green', 'blue', 'amber', 'white', 'uv']);
  assert.ok(near(p.white, 0.6) && near(p.amber, 0.4) && near(p.red, 0) && near(p.green, 0) && near(p.blue, 0) && p.uv === 0, JSON.stringify(p));
  assert.deepEqual(rgbToChannels([1, 0, 0.25], ['cyan', 'magenta', 'yellow']), { cyan: 0, magenta: 1, yellow: 0.75 });
  assert.deepEqual(rgbToChannels([0.2, 0.7, 0.4], ['white']), { white: 0.7 }, 'one kind of emitter: the brightest component');
  assert.deepEqual(rgbToChannels([2, -1, 0.5], ['red', 'green', 'blue']), { red: 1, green: 0, blue: 0.5 }, 'clamped to 0..1');
  assert.deepEqual(rgbToChannels([1, 1, 1], ['red', 'green', 'blue', 'warmWhite']), { red: 0, green: 0, blue: 0, warmWhite: 1 }, 'warm white stands in for white');
});

// ---------------------------------------------------------------------------- patch
function rig() {
  const p = new Patch();
  p.add({ id: 'par1', profile: 'generic-rgbw', mode: '6ch', address: 1, groups: ['front'] });
  p.add({ id: 'par2', profile: 'generic-rgb', address: 7, groups: ['front'] });
  p.add({ id: 'mh', profile: 'generic-moving-head', mode: '16ch', universe: 2, address: 101, groups: ['heads'], limits: { tilt: [0.1, 0.9] } });
  return p;
}

test('patch: placing, groups, and the errors a patch sheet must not have', () => {
  const p = rig();
  assert.deepEqual(p.fixtures.map((f) => [f.id, f.universe, f.address, f.footprint]), [['par1', 1, 1, 6], ['par2', 1, 7, 3], ['mh', 2, 101, 16]]);
  assert.deepEqual(p.ids('front'), ['par1', 'par2']); assert.deepEqual(p.ids('*'), ['par1', 'par2', 'mh']);
  assert.deepEqual(p.ids(['heads', 'par1']), ['mh', 'par1']); assert.deepEqual(p.ids('nobody'), []);
  assert.equal(p.get('mh').mode.id, '16ch'); assert.equal(p.get('x'), null);
  assert.equal(p.add({ id: 'd', profile: 'generic-dimmer', address: 512 }).address, 512, 'a 1-channel fixture fits at 512');
  assert.throws(() => p.add({ id: 'x', profile: 'generic-rgbw', mode: '6ch', address: 508 }), /runs past 512 \(last start address: 507\)/);
  assert.throws(() => p.add({ id: 'x', profile: 'generic-rgbw', mode: '5ch', address: 1 }), /no mode "5ch" \(modes: 4ch, 6ch\)/);
  assert.throws(() => p.add({ id: 'x', profile: 'generic-laser', address: 1 }), /no fixture profile "generic-laser"/);
  assert.throws(() => p.add({ id: 'x', profile: 'generic-rgb', address: 0 }), /address is an integer 1–512/);
  assert.throws(() => p.add({ id: 'x', profile: 'generic-rgb', address: 1, universe: -1 }), /universe/);
  assert.throws(() => p.add({ id: 'par1', profile: 'generic-rgb', address: 1 }), /already patched/);
  assert.throws(() => p.add({ id: 'front', profile: 'generic-rgb', address: 1 }), /already a group name/);
  assert.throws(() => p.add({ id: 'y', profile: 'generic-rgb', address: 1, groups: ['par1'] }), /has the name of a fixture/);
  assert.throws(() => p.add({ id: 'y', profile: 'generic-rgb', address: 1, limits: { dimmer: [0.9, 0.1] } }), /limits\.dimmer/);
  assert.ok(p.remove('d') && !p.remove('d'));
});

test('patch: two fixtures on the same addresses are allowed (doubling) and check() lists them', () => {
  const p = rig();
  assert.deepEqual(p.check(), []);
  p.add({ id: 'twin', profile: 'generic-rgb', address: 5 });                      // 5..7 overlaps par1 (1..6) and par2 (7..9)
  p.add({ id: 'far', profile: 'generic-rgb', universe: 2, address: 1 });          // another universe: no overlap
  assert.deepEqual(p.check().map((x) => [x.ids, x.address]), [[['par1', 'twin'], [5, 6]], [['par2', 'twin'], [7, 7]]]);
  assert.match(p.check()[0].text, /par1 and twin share universe 1, addresses 5–6/);
});

test('patch: properties become the right bytes, 16-bit pan and tilt included', () => {
  const p = rig();
  const U = p.render({
    par1: { dimmer: 1, color: [1, 0.6, 0.2] },
    par2: { dimmer: 0.5, color: [1, 0, 0.5] },
    mh: { dimmer: 1, color: [0, 0, 1], pan: 0.3, tilt: 1, zoom: 0.5, gobo: 1, focus: 0.25 },
  });
  assert.deepEqual(bytesAt(U, 1, 1, 6), [255, 204, 102, 0, 51, 0], 'par1: dimmer, r g b after white, white, strobe open');
  assert.deepEqual(bytesAt(U, 1, 7, 3), [128, 0, 64], 'par2 has no dimmer channel: the dimmer is multiplied into the colour');
  // mh 16ch: pan panFine tilt tiltFine speed dimmer strobe r g b w gobo zoom focus program reset
  const mh = bytesAt(U, 2, 101, 16);
  assert.deepEqual(mh.slice(0, 2), [76, 205], 'pan 0.3 → 19661 = 76·256 + 205');
  assert.deepEqual(mh.slice(2, 4), [230, 102], 'tilt 1 limited to 0.9 → 58982 = 230·256 + 102');
  assert.deepEqual(mh.slice(4, 16), [0, 255, 0, 0, 0, 255, 0, 255, 128, 64, 0, 0]);
  // a fixture with no state gets its defaults: the head waits at the middle, dark
  const idle = p.render({});
  assert.deepEqual(bytesAt(idle, 2, 101, 7), [128, 0, 128, 0, 0, 0, 0]);
  assert.deepEqual(bytesAt(idle, 1, 7, 3), [0, 0, 0]);
  const p2 = new Patch(); p2.add({ id: 'mh8', profile: 'generic-moving-head', mode: '8ch', address: 1 });
  assert.deepEqual(bytesAt(p2.render({ mh8: { pan: 0.3, tilt: 0.5 } }), 1, 1, 2), [77, 128], 'the 8-channel mode: one byte each');
});

test('patch: limits come before the master; blackout darkens and leaves position, zoom and control channels', () => {
  const p = new Patch();
  p.add({ id: 'a', profile: 'generic-dimmer', address: 1, limits: { dimmer: [0, 0.8] } });
  p.add({ id: 'mh', profile: 'generic-moving-head', mode: '16ch', address: 10 });
  p.add({ id: 'rgb', profile: 'generic-rgb', address: 40 });
  const st = { a: { dimmer: 1 }, mh: { dimmer: 1, color: [1, 1, 1], pan: 0.25, tilt: 0.75, zoom: 0.4, strobe: 0 }, rgb: { color: [1, 0.5, 0] } };
  assert.equal(p.render(st).get(1).get(1), 204, '0.8 limit');
  assert.equal(p.render(st, { master: 0.5 }).get(1).get(1), 102, 'limit, then master: 0.8 × 0.5');
  assert.deepEqual(bytesAt(p.render(st, { master: 0.5 }), 1, 40, 3), [128, 64, 0], 'the master reaches a light with no dimmer channel through its colour');
  const on = p.render(st, { controls: { mh: { reset: 200 } } });
  const off = p.render(st, { blackout: true, controls: { mh: { reset: 200 } } });
  assert.equal(off.get(1).get(1), 0); assert.deepEqual(bytesAt(off, 1, 40, 3), [0, 0, 0]);
  const keep = [0, 1, 2, 3, 12, 15];                                              // pan, panFine, tilt, tiltFine, zoom, reset
  for (const i of keep) assert.equal(off.get(1).get(10 + i), on.get(1).get(10 + i), `slot ${i + 1} of the head is not touched by blackout`);
  assert.equal(off.get(1).get(10 + 5), 0, 'head dimmer 0');
  assert.equal(on.get(1).get(25), 200, 'reset written by controls');
  assert.throws(() => p.render(st, { controls: { mh: { dimmer: 5 } } }), /not a control channel/);
  // a control channel cannot be reached through properties
  assert.equal(p.render({ mh: { reset: 1, program: 1 } }).get(1).get(25), 0);
  assert.deepEqual(Object.keys(p.resolve('mh', { reset: 1, gobo: 0.5 })).sort(), ['dimmer', 'gobo']);
});

test('patch: toJSON → fromJSON gives the same patch and the same bytes', () => {
  const p = rig();
  const j = JSON.parse(JSON.stringify(p.toJSON()));
  assert.equal(j.format, 'open-audiovisual/patch@1');
  assert.deepEqual(j.fixtures[2], { id: 'mh', profile: 'generic-moving-head', mode: '16ch', universe: 2, address: 101, groups: ['heads'], limits: { tilt: [0.1, 0.9] } });
  const q = Patch.fromJSON(j);
  const st = { par1: { dimmer: 0.7, color: [0.1, 0.9, 0.3] }, mh: { pan: 0.6, tilt: 0.95, dimmer: 1 } };
  for (const u of [1, 2]) assert.deepEqual(q.render(st).bytes(u), p.render(st).bytes(u));
  assert.throws(() => Patch.fromJSON({ fixtures: [] }), /format/);
  // a profile of your own travels by id: pass it again when reading the patch back
  const own = new Patch({ profiles: [good()] });
  own.add({ id: 't', profile: 'test-par', mode: '3ch', address: 1 });
  assert.throws(() => Patch.fromJSON(own.toJSON()), /no fixture profile "test-par"/);
  assert.equal(Patch.fromJSON(own.toJSON(), { profiles: [good()] }).get('t').footprint, 3);
});

test('patch: the strobe channel is held to the flash cap where its profile gives Hz, and kept open where it does not', () => {
  const p = new Patch({ profiles: [good()] });
  p.add({ id: 't', profile: 'test-par', mode: '7ch', address: 1 });                // strobe: 0–9 open, 10–255 strobe at 1–20 Hz
  p.add({ id: 'g', profile: 'generic-rgbw', mode: '6ch', address: 20 });           // generic: no Hz
  const st = { t: { dimmer: 1, strobe: 1 }, g: { dimmer: 1, strobe: 1 } };
  const capped = p.render(st);
  // 3 Hz on a 1–20 Hz range read as linear over 10–255: 10 + (3 − 1) / 19 · 245 = 35.8 → 35 (never a step faster)
  assert.equal(capped.get(1).get(5), 35);
  assert.ok(near(p.resolve('t', st.t).strobe, 2 / 19));
  assert.equal(capped.get(1).get(25), 0, 'no Hz in the profile: the channel stays open');
  const free = p.render(st, { maxFlashHz: Infinity });
  assert.equal(free.get(1).get(5), 255); assert.equal(free.get(1).get(25), 255);
  assert.equal(p.render({ t: { strobe: 0 } }).get(1).get(5), 0, 'strobe 0 is the open value');
  assert.equal(p.render({ t: { strobe: 1 } }, { blackout: true }).get(1).get(5), 0, 'blackout opens the strobe too');
});

test('patch: a second dimmer or strobe channel, reached by its key, still gets the master, blackout and the flash cap', () => {
  const twin = {
    format: 'open-audiovisual/fixture@1', id: 'two-cell', manufacturer: 'Test', name: 'Two cells', kind: 'par', license: 'MIT', verified: false, verifications: [],
    modes: [{ id: '4ch', channels: ['dimmer', 'dimmer2', 'strobe', 'strobe2'] }],
    channels: {
      dimmer: { type: 'intensity' }, dimmer2: { type: 'intensity' },
      strobe: { type: 'strobe', ranges: [{ from: 0, to: 9, is: 'open' }, { from: 10, to: 255, is: 'strobe' }] },
      strobe2: { type: 'strobe', ranges: [{ from: 0, to: 9, is: 'open' }, { from: 10, to: 255, is: 'strobe', hz: [1, 20] }] },
    },
  };
  const p = new Patch({ profiles: [twin] });
  p.add({ id: 'c', profile: 'two-cell', address: 1, limits: { dimmer: [0, 0.5] } });
  const b = (st, o) => [...p.render({ c: st }, o).bytes(1).slice(0, 4)];
  assert.deepEqual(b({ dimmer: 1 }), [128, 128, 0, 0], 'dimmer drives every intensity channel (and its limit applies)');
  assert.deepEqual(b({ dimmer: 0, dimmer2: 1, strobe2: 1 }), [0, 128, 0, 35], 'dimmer2 by key keeps the dimmer limit; strobe2 is held to 3 Hz');
  assert.deepEqual(b({ dimmer2: 1, strobe: 1, strobe2: 1 }, { blackout: true }), [0, 0, 0, 0], 'blackout: both dark, both strobes open');
  assert.deepEqual(b({ dimmer2: 1 }, { master: 0 }), [0, 0, 0, 0], 'the master reaches the second dimmer');
  assert.deepEqual(b({ strobe: 1, strobe2: 1 }), [0, 0, 0, 35], 'the first strobe has no Hz: kept open');
  assert.deepEqual(b({ strobe: 1, strobe2: 1 }, { maxFlashHz: Infinity }), [0, 0, 255, 255]);
});
