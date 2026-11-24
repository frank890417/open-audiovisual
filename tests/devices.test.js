// @openav/devices: one collection of show devices, read off the files that already describe them.
//
// What must hold: every record (hand-written or read off a profile, a fixture or a part) is valid against
// device.schema.json and validateDevice(); nothing that exists on disk is left out of devices(), and the list is not stale;
// search finds a device by the words people type; device() hands each kind to the package that drives it, and a camera or a
// microphone is asked for only when the caller says so (fakes here: no MIDI, camera or microphone permission anywhere);
// listing never loads a profile JSON; every `use` names a real export (and a real out-bridge sink).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { devices, device, deviceKinds } from '../packages/devices/index.js';
import { validateDevice, indexRow, KINDS, DEVICE_FORMAT } from '../packages/devices/record.js';
import { fromMidiProfile, fromFixture, fromPart } from '../packages/devices/derive.js';
import { PARTS } from '../packages/hw/parts.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PKGS = path.join(ROOT, 'packages');
const readJson = (rel) => JSON.parse(fs.readFileSync(path.join(PKGS, rel), 'utf8'));
const jsonIn = (rel) => fs.readdirSync(path.join(PKGS, rel)).filter((f) => f.endsWith('.json') && !f.endsWith('.schema.json')).sort();
const unstamp = (s) => String(s).replace(/\?v=[\w.+-]+/g, '');
const RECORDS = jsonIn('devices/records').map((f) => readJson(`devices/records/${f}`));

/** Every record the collection holds, in full: hand-written ones as written, the others read off their files. */
function allRecords() {
  const out = [];
  for (const f of jsonIn('midi/profiles')) out.push(fromMidiProfile(readJson(`midi/profiles/${f}`), { file: `midi/profiles/${f}` }));
  for (const f of jsonIn('midi/profiles/imported')) out.push(fromMidiProfile(readJson(`midi/profiles/imported/${f}`), { file: `midi/profiles/imported/${f}` }));
  for (const f of jsonIn('dmx/fixtures')) out.push(fromFixture(readJson(`dmx/fixtures/${f}`), { file: `dmx/fixtures/${f}` }));
  for (const [id, p] of Object.entries(PARTS)) out.push(fromPart(id, p));
  return [...out, ...RECORDS];
}

// ------------------------------------------------------------------ the JSON Schema
// A small reader for the part of JSON Schema device.schema.json uses: no dependency, and the file stays honest.
function check(schema, v, root, at = '$', out = []) {
  if (schema.$ref) return check(schema.$ref.split('/').slice(1).reduce((s, k) => s[k], root), v, root, at, out);
  const is = { object: () => v !== null && typeof v === 'object' && !Array.isArray(v), array: () => Array.isArray(v), string: () => typeof v === 'string',
    number: () => typeof v === 'number', integer: () => Number.isInteger(v), boolean: () => typeof v === 'boolean', null: () => v === null };
  if (schema.type && ![].concat(schema.type).some((t) => is[t]())) { out.push(`${at}: not ${schema.type}`); return out; }
  if ('const' in schema && v !== schema.const) out.push(`${at}: is not ${JSON.stringify(schema.const)}`);
  if (schema.enum && !schema.enum.includes(v)) out.push(`${at}: ${JSON.stringify(v)} not in enum`);
  if (typeof v === 'string') {
    if (schema.pattern && !new RegExp(schema.pattern).test(v)) out.push(`${at}: ${v} does not match ${schema.pattern}`);
    if (schema.minLength && v.length < schema.minLength) out.push(`${at}: too short`);
  }
  if (Array.isArray(v)) {
    if (schema.minItems && v.length < schema.minItems) out.push(`${at}: too few items`);
    if (schema.uniqueItems && new Set(v.map((x) => JSON.stringify(x))).size !== v.length) out.push(`${at}: items repeat`);
    if (schema.items) v.forEach((x, i) => check(schema.items, x, root, `${at}[${i}]`, out));
  }
  if (typeof v === 'number' && schema.minimum !== undefined && v < schema.minimum) out.push(`${at}: below minimum`);
  if (is.object()) {
    for (const k of schema.required || []) if (!(k in v)) out.push(`${at}: missing ${k}`);
    if (schema.minProperties && Object.keys(v).length < schema.minProperties) out.push(`${at}: too few properties`);
    for (const [k, x] of Object.entries(v)) {
      if (schema.properties && k in schema.properties) check(schema.properties[k], x, root, `${at}.${k}`, out);
      else if (schema.additionalProperties === false) out.push(`${at}: unknown property ${k}`);
      else if (typeof schema.additionalProperties === 'object') check(schema.additionalProperties, x, root, `${at}.${k}`, out);
    }
  }
  return out;
}
const SCHEMA = readJson('devices/device.schema.json');

test('schema and validateDevice: every record in the collection, hand-written and read off its file, is valid', () => {
  assert.equal(SCHEMA.properties.format.const, DEVICE_FORMAT);
  assert.deepEqual(SCHEMA.properties.kind.enum, [...KINDS], 'the schema and the code list the same kinds');
  const all = allRecords();
  assert.ok(all.length >= 85, `${all.length} records`);
  for (const r of all) {
    assert.deepEqual(check(SCHEMA, r, SCHEMA), [], `${r.id}: schema`);
    assert.deepEqual(validateDevice(r), [], `${r.id}: validateDevice`);
  }
});

test('schema and validateDevice: a bad record is refused, one sentence per problem', () => {
  const good = () => structuredClone(RECORDS.find((r) => r.id === 'yamaha-ag06'));
  assert.deepEqual(validateDevice(good()), []);
  const bad = (change, re, inSchema = true) => {
    const r = good(); change(r);
    const probs = validateDevice(r);
    assert.ok(probs.some((x) => re.test(x)), `${re} in ${JSON.stringify(probs)}`);
    if (inSchema) assert.ok(check(SCHEMA, r, SCHEMA).length, `the schema refuses it too (${re})`);
  };
  bad((r) => { r.format = 'device@0'; }, /format/);
  bad((r) => { r.id = 'Yamaha AG06'; }, /id must be/);
  bad((r) => { r.kind = 'mixer'; }, /kind must be/);
  bad((r) => { r.connections.push('usb'); }, /listed twice/);
  bad((r) => { r.connections.push('thunderbolt'); }, /connections are from/);
  bad((r) => { r.protocols.push('USB Audio'); }, /protocols are lower-case/);
  bad((r) => { r.data = {}; }, /data needs ref, facts or both/);
  bad((r) => { r.data.facts[0].source = 9; }, /source must be an index into sources/, false);
  bad((r) => { delete r.data.facts[0].source; }, /source must be an index/);
  bad((r) => { r.data.facts[0].value = null; }, /value is missing/);
  bad((r) => { delete r.media; }, /needs media/, false);
  bad((r) => { r.media.input = 'videoinput'; }, /input is "audioinput"/, false);
  bad((r) => { r.media.labels = ['(']; }, /bad pattern/, false);
  bad((r) => { r.setup[0].zh = '先切到待機；再接線。'; }, /uses "；"/, false);
  bad((r) => { r.setup[0].en = '先接線'; }, /\.en has Chinese/, false);
  bad((r) => { r.use = []; }, /use is a non-empty list, or null/);
  bad((r) => { r.use[0].package = 'openav-audio'; }, /package is @openav/);
  bad((r) => { r.verified = true; }, /only a check on the unit itself makes it true/, false);
  bad((r) => { r.verified = true; r.verifications = [{ date: '2026-11-25', by: 'a test', method: 'simulated' }]; }, /no verification has method "hardware"/, false);
  bad((r) => { r.extra = 1; }, /unknown field "extra"/);
  const ok = good(); ok.verified = true; ok.verifications = [{ date: '2026-11-25', by: 'someone with the unit', method: 'hardware', firmware: 'unknown', os: 'macOS', browser: 'Chrome' }];
  assert.deepEqual(validateDevice(ok), [], 'a hardware verification is what verified: true needs');
  const none = good(); none.use = null; none.kind = 'printer'; delete none.media;
  assert.deepEqual(validateDevice(none), [], 'use: null is allowed: OAV has no way to reach it');
  assert.deepEqual(check(SCHEMA, none, SCHEMA), []);
});

// ------------------------------------------------------------------ nothing left out
test('nothing left out: every profile, imported profile, fixture, part and record is in devices() once, and catalog.js is not stale', async () => {
  const rows = devices();
  const byId = new Map(rows.map((r) => [r.id, r]));
  assert.equal(byId.size, rows.length, 'ids are unique across kinds');
  const expect = [
    ...jsonIn('midi/profiles').map((f) => ['midi-profile', readJson(`midi/profiles/${f}`).id, `midi/profiles/${f}`]),
    ...jsonIn('midi/profiles/imported').map((f) => ['midi-profile', readJson(`midi/profiles/imported/${f}`).id, `midi/profiles/imported/${f}`]),
    ...jsonIn('dmx/fixtures').map((f) => ['dmx-fixture', readJson(`dmx/fixtures/${f}`).id, `dmx/fixtures/${f}`]),
    ...Object.keys(PARTS).map((id) => ['hw-part', id, 'hw/parts.js']),
    ...jsonIn('devices/records').map((f) => ['device-record', readJson(`devices/records/${f}`).id, `devices/records/${f}`]),
  ];
  for (const [from, id, file] of expect) {
    const r = byId.get(id);
    assert.ok(r, `${file}: "${id}" is not in the collection (run node tools/build-devices.mjs)`);
    assert.equal(r.from, from, `${id}: from`); assert.equal(r.file, file, `${id}: file`);
  }
  assert.equal(rows.length, expect.length, 'and nothing else');
  // each row is what its file says now
  const fresh = new Map(allRecords().map((r) => [r.id, r]));
  for (const r of rows) assert.deepEqual({ ...r }, indexRow(fresh.get(r.id), r.from, r.file), `${r.id}: the row is stale`);
  const { buildCatalog, catalogText, CATALOG_FILE } = await import('../tools/build-devices.mjs');
  assert.equal(unstamp(fs.readFileSync(path.join(ROOT, CATALOG_FILE), 'utf8')), catalogText(await buildCatalog()), 'catalog.js is what the build writes');
  // the counts by kind: MIDI = hand-written + imported profiles
  const count = (k) => rows.filter((r) => r.kind === k).length;
  assert.equal(count('midi-controller'), jsonIn('midi/profiles').length + jsonIn('midi/profiles/imported').length);
  assert.equal(count('dmx-fixture'), jsonIn('dmx/fixtures').length);
  assert.equal(count('part'), Object.keys(PARTS).length);
});

test('the owner\'s gear: the three controllers surface from their profiles, the first hand-written records are unverified and cite what they say', () => {
  for (const [q, id] of [['minilab 3', 'arturia-minilab3'], ['nanoKONTROL2', 'korg-nanokontrol2'], ['launchkey 25 mk4', 'novation-launchkey-25-mk4'], ['launchkey 37 mk4', 'novation-launchkey-37-mk4']]) {
    const hit = devices({ q });
    assert.equal(hit[0]?.id, id, `"${q}" finds ${id} first`);
    assert.equal(hit[0].kind, 'midi-controller'); assert.equal(hit[0].from, 'midi-profile');
  }
  const ids = RECORDS.map((r) => r.id).sort();
  assert.deepEqual(ids, ['audinate-dante-virtual-soundcard', 'brother-ql-810w', 'enttec-dmx-usb-pro', 'logitech-mx-brio', 'ultraleap-leap-motion-controller-2', 'wled', 'yamaha-ag06']);
  for (const r of RECORDS) {
    assert.equal(r.verified, false, `${r.id}: unverified until someone checks it on the unit`);
    assert.deepEqual(r.verifications, [], `${r.id}: empty log`);
    assert.ok(r.sources.length, `${r.id}: sources`);
    for (const s of r.sources) { assert.match(s.url || '', /^https:\/\//, `${r.id}: ${s.title}: a URL`); assert.match(s.read || '', /^\d{4}-\d{2}-\d{2}$/, `${r.id}: ${s.title}: the day it was read`); }
    assert.ok(r.data.facts.length, `${r.id}: facts`);
    const cited = new Set([...r.data.facts.map((f) => f.source), ...r.setup.map((x) => x.source), ...r.problems.map((x) => x.source), ...(r.media ? r.media.sources : [])]);
    r.sources.forEach((s, i) => assert.ok(cited.has(i), `${r.id}: source ${i} (${s.title}) is cited by something`));
  }
  assert.equal(RECORDS.find((r) => r.id === 'brother-ql-810w').use, null, 'no OAV path to the printer, said so');
});

// ------------------------------------------------------------------ search
test('devices(): search by name, alias, maker or id; kind and connection filters', () => {
  assert.deepEqual(deviceKinds, KINDS);
  assert.ok(Object.isFrozen(deviceKinds) && Object.isFrozen(devices()[0]) && Object.isFrozen(devices()[0].aliases), 'rows are frozen');
  assert.equal(devices({ q: 'minilab3' })[0].id, 'arturia-minilab3', 'spaces do not matter');
  assert.equal(devices({ q: 'ARTURIA minilab' })[0].id, 'arturia-minilab3', 'case does not matter, the maker counts');
  assert.deepEqual(devices({ q: 'AG06' }).map((r) => r.id), ['yamaha-ag06']);
  assert.deepEqual(devices({ q: 'leap motion' }).map((r) => r.id), ['ultraleap-leap-motion-controller-2']);
  assert.deepEqual(devices({ q: '標籤機' }).map((r) => r.id), ['brother-ql-810w'], 'Chinese aliases');
  assert.ok(devices({ q: '加速度計' }).some((r) => r.id === 'lis3dh-breakout'), 'a part by its Chinese name');
  assert.ok(devices({ q: 'rgbw' }).some((r) => r.id === 'generic-rgbw'));
  assert.deepEqual(devices({ q: 'no such thing here' }), []);
  assert.equal(devices({ q: 'apc40' })[0].id, 'akai-apc40', 'an exact name comes before a longer one');
  assert.ok(devices({ kind: 'midi-controller' }).every((r) => r.kind === 'midi-controller'));
  assert.deepEqual(devices({ kind: 'camera' }).map((r) => r.id), ['logitech-mx-brio']);
  assert.deepEqual(devices({ kind: ['camera', 'printer'] }).map((r) => r.kind).sort(), ['camera', 'printer']);
  assert.deepEqual(devices({ connection: 'dmx-xlr5' }).map((r) => r.id), ['enttec-dmx-usb-pro']);
  assert.throws(() => devices({ kind: 'mixer' }), /one of midi-controller/);
  assert.throws(() => devices({ connection: 'thunderbolt' }), /one of usb/);
  const kinds = devices().map((r) => KINDS.indexOf(r.kind));
  assert.deepEqual(kinds, [...kinds].sort((a, b) => a - b), 'listed in the order of deviceKinds');
});

// ------------------------------------------------------------------ device(), kind by kind
test('device(): a MIDI controller is its profile, mapper routes and a MidiController in your MidiControllers', async () => {
  const { MidiControllers } = await import('../packages/midi/manager.js');
  const { Signals } = await import('../packages/core/src/signals.js');
  const mini = await device('arturia-minilab3');
  assert.equal(mini.kind, 'midi-controller'); assert.equal(mini.profile.id, 'arturia-minilab3');
  assert.equal(mini.record.data.ref.file, 'midi/profiles/arturia-minilab3.json');
  assert.deepEqual(mini.routes({ knob1: 'hue', pad1: { target: 'burst', on: 'hit' } }).map((r) => [r.source, r.target]), [['midi/minilab3/knob1', 'hue'], ['midi/minilab3/pad1/hit', 'burst']]);
  const signals = new Signals();
  const other = await device('korg-nanokontrol2');
  const mcs = new MidiControllers({ profiles: [other.profile], signals, storage: null, imported: [] });
  const c = mini.addTo(mcs);
  assert.equal(c.id, 'arturia-minilab3'); assert.equal(mcs.get('arturia-minilab3'), c, 'the manager holds it');
  const knob1 = mini.profile.controls.find((x) => x.id === 'knob1');
  c.ingest([0xb0 + (knob1.ch ?? mini.profile.channel ?? 1) - 1, knob1.cc, 127], { source: 'hw' });
  assert.equal(signals.get('midi/minilab3/knob1'), 1, 'the hardware message publishes the named signal');
  const imp = await device('akai-apc20');
  assert.equal(imp.record.license, 'Apache-2.0'); assert.equal(imp.record.data.ref.file, 'midi/profiles/imported/akai-apc20.json');
  const smc = await device('m-vave-smc-mixer');
  assert.equal(smc.record.verified, false, 'a hardware log that left controls unchecked is not a verified device');
  assert.equal(smc.record.verifications[0].method, 'hardware');
  const p = structuredClone(mini.profile);
  p.verifications = [{ date: '2026-11-25', by: 'a test', method: 'hardware', firmware: 'x', os: 'x', browser: 'x', results: Object.fromEntries(p.controls.map((x) => [x.id, 'match'])) }];
  p.controls.forEach((x) => { x.verified = true; });
  assert.equal(fromMidiProfile(p, { file: 'x.json' }).verified, true, 'every control checked on a unit: verified');
  await assert.rejects(device('minilab3'), /unknown device "minilab3" \(did you mean arturia-minilab3/, 'a short name is not an id');
});

test('device(): a DMX fixture patches itself into a Patch', async () => {
  const { Patch } = await import('../packages/dmx/patch.js');
  const par = await device('generic-rgbw', { universe: 2 });
  assert.equal(par.kind, 'dmx-fixture'); assert.equal(par.profile.id, 'generic-rgbw');
  const patch = new Patch();
  const a = par.patch(patch, { address: 1, mode: '6ch' });
  assert.equal(a.id, 'generic-rgbw-2-1'); assert.equal(a.universe, 2, 'device() options are the defaults'); assert.equal(a.footprint, 6);
  const b = par.patch(patch, { id: 'par2', address: 7, universe: 1, groups: ['front'] });
  assert.equal(b.mode.id, '4ch', 'the first mode when none is named'); assert.deepEqual([...b.groups], ['front']);
  assert.deepEqual(patch.ids('front'), ['par2']);
  assert.throws(() => par.patch(patch, { address: 510, mode: '6ch' }), /runs past 512/);
});

test('device(): a part is the @openav/hw library entry; other kinds are their record', async () => {
  const { HW_PARTS } = await import('../packages/hw/index.js');
  const ring = await device('neopixel-ring-12');
  assert.equal(ring.kind, 'part'); assert.deepEqual(ring.part, HW_PARTS['neopixel-ring-12']);
  assert.equal(ring.record.manufacturer, null, 'the library names no maker');
  for (const [id, kind] of [['brother-ql-810w', 'printer'], ['wled', 'led-controller'], ['enttec-dmx-usb-pro', 'dmx-interface'], ['ultraleap-leap-motion-controller-2', 'sensor']]) {
    const h = await device(id);
    assert.equal(h.kind, kind); assert.deepEqual(Object.keys(h).sort(), ['id', 'kind', 'name', 'record']);
  }
});

/** A stand-in for navigator.mediaDevices that writes down every call. */
function fakeMedia(list, { grantLabels = null } = {}) {
  const calls = [];
  let devs = list;
  const api = {
    calls,
    async enumerateDevices() { calls.push('enumerate'); return devs.map((d) => ({ ...d })); },
    async getUserMedia(c) {
      calls.push(['gum', c]);
      if (grantLabels) devs = grantLabels;     // the permission was given: the names show now
      const id = (c.video || c.audio).deviceId?.exact || devs.find((d) => d.kind === (c.video ? 'videoinput' : 'audioinput'))?.deviceId;
      const track = { stopped: false, stop() { this.stopped = true; }, getSettings: () => ({ deviceId: id }) };
      return { c, track, getTracks: () => [track] };
    },
  };
  return api;
}

test('device(): a camera is found by its label and asked for only when open() is called', async () => {
  const media = fakeMedia([{ kind: 'videoinput', label: 'FaceTime HD Camera', deviceId: 'ft' }, { kind: 'videoinput', label: 'MX Brio (046d:0944)', deviceId: 'brio' }, { kind: 'audioinput', label: 'MX Brio', deviceId: 'mic' }]);
  const cam = await device('logitech-mx-brio', { mediaDevices: media });
  assert.deepEqual(media.calls, [], 'device() asks for nothing');
  assert.deepEqual(cam.constraints(), { video: { width: { ideal: 1920 }, height: { ideal: 1080 }, frameRate: { ideal: 60 } }, audio: false });
  assert.deepEqual(media.calls, [], 'constraints() is pure');
  assert.equal((await cam.find()).deviceId, 'brio', 'the video input with its name, not its microphone');
  assert.deepEqual(media.calls, ['enumerate'], 'find() only enumerates');
  const s = await cam.open();
  assert.deepEqual(s.c.video.deviceId, { exact: 'brio' });
  assert.equal(media.calls.filter((x) => x[0] === 'gum').length, 1, 'one request');
  // not plugged in, names visible: nothing is opened, and the error says what is there
  const other = fakeMedia([{ kind: 'videoinput', label: 'FaceTime HD Camera', deviceId: 'ft' }]);
  const cam2 = await device('logitech-mx-brio', { mediaDevices: other });
  assert.equal(await cam2.find(), null);
  await assert.rejects(cam2.open(), /no camera whose name matches .*found: FaceTime HD Camera/);
  assert.ok(!other.calls.some((x) => x[0] === 'gum'), 'no permission asked for a camera that is not there');
  // no permission yet: names are empty; open() asks once, looks again, and reopens the MX Brio if the default was another
  const hidden = [{ kind: 'videoinput', label: '', deviceId: '' }, { kind: 'videoinput', label: '', deviceId: '' }];
  const shown = [{ kind: 'videoinput', label: 'FaceTime HD Camera', deviceId: 'ft' }, { kind: 'videoinput', label: 'MX Brio', deviceId: 'brio' }];
  const fresh = fakeMedia(hidden, { grantLabels: shown });
  const cam3 = await device('logitech-mx-brio', { mediaDevices: fresh });
  assert.equal(await cam3.find(), null, 'no names before the permission: null, not a guess');
  const s3 = await cam3.open();
  const gums = fresh.calls.filter((x) => x[0] === 'gum');
  assert.equal(gums.length, 2, 'the prompt, then the MX Brio by id');
  assert.equal(gums[0][1].video.deviceId, undefined); assert.deepEqual(s3.c.video.deviceId, { exact: 'brio' });
  await assert.rejects((await device('logitech-mx-brio')).find(), /no navigator\.mediaDevices/, 'in Node there is no camera, and it says so');
});

test('device(): an audio interface opens with the browser\'s voice processing off', async () => {
  const media = fakeMedia([{ kind: 'audioinput', label: 'Default - MacBook Pro Microphone', deviceId: 'default' }, { kind: 'audioinput', label: 'AG06/AG03', deviceId: 'ag' }]);
  const ag = await device('yamaha-ag06', { mediaDevices: media });
  assert.deepEqual(media.calls, []);
  assert.equal((await ag.find()).deviceId, 'ag');
  const s = await ag.open();
  assert.deepEqual(s.c, { audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false, channelCount: { ideal: 2 }, deviceId: { exact: 'ag' } }, video: false });
  const dvs = await device('audinate-dante-virtual-soundcard', { mediaDevices: fakeMedia([{ kind: 'audioinput', label: 'Dante Virtual Soundcard (2ch)', deviceId: 'dvs' }]) });
  assert.equal((await dvs.find()).deviceId, 'dvs');
});

// ------------------------------------------------------------------ every `use` is real
test('use: every package and entry a record names exists today (and every out-bridge sink)', async () => {
  const seen = new Set();
  for (const r of allRecords()) {
    for (const u of r.use || []) {
      const key = `${u.package}:${u.entry}:${u.sink || ''}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const dir = u.package.replace('@openav/', '');
      const pj = readJson(`${dir}/package.json`);
      const main = typeof pj.exports === 'object' ? pj.exports['.'] : pj.main;
      const mod = await import(pathToFileURL(path.join(PKGS, dir, main)).href);
      assert.ok(u.entry in mod, `${r.id}: ${u.package} exports ${u.entry}`);
      if (u.sink) assert.ok(fs.existsSync(path.join(PKGS, 'out/bridge/sinks', `${u.sink}.js`)), `${r.id}: the out-bridge has a ${u.sink} sink`);
    }
  }
  assert.ok(seen.size >= 8, `${seen.size} paths`);
});

// ------------------------------------------------------------------ laziness
/** The static import graph of a module (stamps stripped): every file it reaches without calling import(). */
function staticGraph(file, seen = new Set()) {
  if (seen.has(file)) return seen;
  seen.add(file);
  if (!file.endsWith('.js')) return seen;
  const src = fs.readFileSync(file, 'utf8');
  for (const m of src.matchAll(/^\s*(?:import|export)\s[^'"]*?from\s+['"]([^'"]+)['"]/gm)) {
    if (!m[1].startsWith('.')) continue;
    staticGraph(path.resolve(path.dirname(file), unstamp(m[1])), seen);
  }
  return seen;
}

test('laziness: listing reaches no profile JSON and no index that imports them; device() loads the one file it needs', () => {
  const graph = [...staticGraph(path.join(PKGS, 'devices/index.js'))].map((f) => path.relative(PKGS, f));
  assert.ok(graph.includes('devices/catalog.js'));
  assert.deepEqual(graph.filter((f) => f.endsWith('.json')), [], 'no JSON is imported statically');
  for (const f of ['midi/index.js', 'midi/profiles/index.js', 'dmx/index.js', 'dmx/fixtures/index.js', 'hw/index.js', 'hw/parts.js']) assert.ok(!graph.includes(f), `${f} is not reached statically`);
  // and at run time, in a fresh process that writes down every JSON module it loads
  const code = `
    import * as mod from 'node:module';
    const seen = [];
    if (typeof mod.registerHooks !== 'function') { console.log(JSON.stringify({ skip: true })); process.exit(0); }
    mod.registerHooks({ load(url, context, next) { if (/\\.json(\\?|$)/.test(url)) seen.push(url.split('/').pop()); return next(url, context); } });
    const { devices, device } = await import(${JSON.stringify(pathToFileURL(path.join(PKGS, 'devices/index.js')).href)});
    devices(); devices({ q: 'minilab' }); devices({ kind: 'dmx-fixture' });
    const listing = seen.length;
    await device('arturia-minilab3');
    const one = [...seen];
    await device('generic-rgbw');
    console.log(JSON.stringify({ listing, one, two: seen }));`;
  const r = spawnSync(process.execPath, ['--input-type=module', '-e', code], { encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
  const out = JSON.parse(r.stdout.trim().split('\n').pop());
  if (out.skip) return;   // a Node without module.registerHooks: the static check above still holds
  assert.equal(out.listing, 0, 'devices() loaded no JSON');
  assert.deepEqual(out.one, ['arturia-minilab3.json'], 'device() loaded its one profile');
  assert.deepEqual(out.two, ['arturia-minilab3.json', 'generic-rgbw.json']);
});
