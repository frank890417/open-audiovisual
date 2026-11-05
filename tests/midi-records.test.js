// The profile format beyond notes and CCs: verification records, SysEx as data, the LED palette, and the JSON Schema
// other software reads. The rule that matters most: `verified: true` is a claim, and a claim without hardware evidence is red.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { validateProfile, normalizeProfile } from '../packages/midi/profiles.js';
import { PROFILES, profileById } from '../packages/midi/profiles/index.js';
import { parseHex, formatHex, sysexBytes, sysexMessage, parseSysexTemplate, parseDeviceInquiry, DEVICE_INQUIRY } from '../packages/midi/sysex.js';
import { evidenceOf, verificationOf, verificationSummary } from '../packages/midi/verify.js';

const clone = (p) => JSON.parse(JSON.stringify(p));
const base = () => clone(profileById('akai-lpd8'));
const hardware = (results, extra = {}) => ({ date: '2026-11-12', by: 'A. Tester', method: 'hardware', firmware: '1.0.4', os: 'macOS 26.1', browser: 'Chrome 142', results, ...extra });
const errsOf = (p) => validateProfile(p).join('\n');

// ------------------------------------------------------------------ verification records
test('every shipped profile stays valid, and none claims a hardware check it does not have', () => {
  assert.ok(PROFILES.length >= 27);
  for (const p of PROFILES) {
    assert.deepEqual(validateProfile(p), [], p.id);
    for (const c of p.controls) if (c.verified === true) assert.ok(p.verifications?.length, `${p.id}: ${c.id} is true with an empty log`);
  }
});

test('verified: true without a hardware record is refused, whatever else is in the log', () => {
  const p = base(); const id = p.controls[0].id;
  p.controls[0].verified = true;
  assert.match(errsOf(p), new RegExp(`control "${id}": verified is true but no hardware check`));
  for (const method of ['virtual', 'simulated']) {
    p.verifications = [hardware({ [id]: 'match' }, { method })];
    assert.match(errsOf(p), /no hardware check/, `${method} does not confirm`);
  }
  p.verifications = [hardware({ [id]: 'mismatch' })];
  assert.match(errsOf(p), /no hardware check/, 'a mismatch does not confirm');
  p.verifications = [hardware({ [p.controls[1].id]: 'match' })];
  assert.match(errsOf(p), /no hardware check/, 'a check of another control does not confirm this one');
  p.verifications = [hardware({ [id]: 'match' })];
  assert.deepEqual(validateProfile(p), []);
});

test('a hardware record must say when, who, and on what', () => {
  const id = base().controls[0].id;
  const bad = (edit, re) => { const p = base(); const v = hardware({ [id]: 'match' }); edit(v); p.verifications = [v]; assert.match(errsOf(p), re); };
  bad((v) => { delete v.firmware; }, /must record firmware/);
  bad((v) => { v.os = ' '; }, /must record os/);
  bad((v) => { delete v.browser; }, /must record browser/);
  bad((v) => { delete v.by; }, /by must say who/);
  bad((v) => { v.date = '2026-13-40'; }, /real YYYY-MM-DD/);
  bad((v) => { v.date = '11/12/2026'; }, /real YYYY-MM-DD/);
  bad((v) => { v.method = 'guess'; }, /method must be one of/);
  bad((v) => { v.results = []; }, /results must be an object/);
  bad((v) => { v.results = { nope: 'match' }; }, /names "nope"/);
  bad((v) => { v.results = { [id]: 'great' }; }, /must be one of match/);
  bad((v) => { v.results = { [id]: 'corrected' }; }, /keep the old message/);
  bad((v) => { v.results = { [id]: { result: 'match', led: 'lit' } }; }, /led must be match or mismatch/);
  const p = base(); p.controls[0].verified = 'yes'; assert.match(errsOf(p), /verified must be true or false/);
  const p2 = base(); p2.verifications = {}; assert.match(errsOf(p2), /verifications must be an array/);
  // a virtual check has less to say, and may say it
  const v = base(); v.verifications = [{ date: '2026-11-05', by: 'CI', method: 'virtual', results: { [id]: 'match' } }];
  assert.deepEqual(validateProfile(v), []);
});

test('the three levels read off the control; the log reads per control; old files mean what they meant', () => {
  assert.equal(evidenceOf({ verified: true }), 'hardware');
  assert.equal(evidenceOf({ verified: false }), 'unconfirmed');
  assert.equal(evidenceOf({}), 'source');
  const p = base(), [a, b] = p.controls.map((c) => c.id);
  assert.equal(verificationOf(p, a), null);
  p.verifications = [hardware({ [a]: 'match' }, { date: '2026-11-01' }), hardware({ [a]: { result: 'corrected', was: { msg: 'cc', ch: 1, cc: 1 } }, [b]: 'absent' }, { date: '2026-11-12', firmware: '2.0' }), hardware({ [a]: 'mismatch' }, { date: '2026-10-01' })];
  const r = verificationOf(p, a);
  assert.equal(r.result, 'corrected'); assert.equal(r.firmware, '2.0'); assert.equal(r.was.cc, 1); assert.equal(r.results, undefined);
  assert.equal(verificationOf(p, b).result, 'absent');
  const s = verificationSummary(p);
  assert.equal(s.checks, 3); assert.equal(s.latest.date, '2026-11-12'); assert.equal(s.controls, p.controls.length);
  assert.equal(s.hardware + s.source + s.unconfirmed, s.controls);
  assert.equal(verificationSummary(profileById('akai-lpd8')).latest, null);
});

test('the new fields reach a normalized profile unharmed', () => {
  const p = base(); p.verifications = [hardware({ [p.controls[0].id]: 'match' })]; p.license = 'Apache-2.0'; p.face.auto = true;
  const n = normalizeProfile(p);
  assert.equal(n.verifications.length, 1); assert.equal(n.license, 'Apache-2.0'); assert.equal(n.face.auto, true);
});

// ------------------------------------------------------------------ SysEx
const withSysex = (messages, extra = {}) => ({ ...base(), sysex: { messages, ...extra } });
const msg = (over = {}) => ({ id: 'prog', purpose: 'mode', label: 'Programmer mode', bytes: 'F0 00 20 29 02 0D 0E 01 F7', cite: { source: 0, where: 'p. 7' }, ...over });

test('hex text and bytes round trip, and a typo stops here', () => {
  assert.deepEqual(parseHex('F0 7E 7F 06 01 F7'), DEVICE_INQUIRY);
  assert.deepEqual(parseHex('F0h 7Eh 0x7F, 06h'), [240, 126, 127, 6]);
  assert.equal(formatHex(DEVICE_INQUIRY), 'F0 7E 7F 06 01 F7');
  assert.equal(formatHex([1, 0x7f]), '01 7F');
  assert.equal(formatHex(null), '');
  assert.throws(() => parseHex('F0 GG'), /not a hex byte/);
});

test('sysexBytes fills arguments, takes defaults, splits big values and refuses a wrong byte', () => {
  const t = { id: 't', bytes: 'F0 11 77 {template} F7', args: [{ name: 'template', min: 0, max: 15, default: 8 }] };
  assert.deepEqual(sysexBytes(t), [0xf0, 0x11, 0x77, 8, 0xf7]);
  assert.deepEqual(sysexBytes(t, { template: 3 }), [0xf0, 0x11, 0x77, 3, 0xf7]);
  assert.throws(() => sysexBytes(t, { template: 16 }), /outside 0\.\.15/);
  assert.throws(() => sysexBytes({ id: 'u', bytes: 'F0 {a} F7', args: [{ name: 'a' }] }), /"a" is missing/);
  assert.deepEqual(sysexBytes({ id: 's', bytes: 'F0 {r.msb} {r.lsb} F7', args: [{ name: 'r', max: 255 }] }, { r: 200 }), [0xf0, 1, 72, 0xf7]);
  assert.deepEqual(parseSysexTemplate('F0 {a.lsb} F7').map((x) => x.part ?? x.byte), [0xf0, 'lsb', 0xf7]);
  assert.throws(() => parseSysexTemplate('F0 {a b} F7'), /neither a hex byte/);
});

test('a SysEx block is checked for shape, arguments, citations and what can run unattended', () => {
  assert.deepEqual(validateProfile(withSysex([msg()])), []);
  const bad = (p, re) => assert.match(errsOf(p), re);
  bad({ ...base(), sysex: { messages: 'no' } }, /sysex\.messages must be an array/);
  bad(withSysex([msg({ id: 'Prog' })]), /id must be lower-case/);
  bad(withSysex([msg({ purpose: 'magic' })]), /purpose must be one of/);
  bad(withSysex([msg({ label: '' })]), /needs a label/);
  bad(withSysex([msg({ dir: 'up' })]), /dir must be out or in/);
  bad(withSysex([msg({ cite: undefined })]), /cite\.source must be an index/);
  bad(withSysex([msg({ cite: { source: 99 } })]), /cite\.source must be an index/);
  bad(withSysex([msg({ bytes: '00 20 F7' })]), /start with F0 and end with F7/);
  bad(withSysex([msg({ bytes: 'F0 80 F7' })]), /data byte 80 is above 7F/);
  bad(withSysex([msg({ bytes: 'F0 ZZ F7' })]), /neither a hex byte/);
  bad(withSysex([msg({ bytes: 'F0 {a} F7' })]), /\{a\} is used in bytes but not declared/);
  bad(withSysex([msg({ args: [{ name: 'a' }] })]), /"a" is declared but not used/);
  bad(withSysex([msg({ bytes: 'F0 {a} F7', args: [{ name: 'a', max: 200 }] })]), /0 ≤ min ≤ max ≤ 127/);
  bad(withSysex([msg({ bytes: 'F0 {a} F7', args: [{ name: 'a', default: 200 }] })]), /default is outside/);
  bad(withSysex([msg(), msg()]), /duplicate id/);
  bad(withSysex([msg({ undo: 'ghost' })]), /undo "ghost" is not a message/);
  bad(withSysex([msg()], { connect: ['ghost'] }), /"ghost" is not a message/);
  bad(withSysex([msg({ dir: 'in' })], { connect: ['prog'] }), /cannot be sent to it/);
  bad(withSysex([msg({ bytes: 'F0 {a} F7', args: [{ name: 'a' }] })], { connect: ['prog'] }), /cannot be sent unattended/);
  assert.deepEqual(validateProfile(withSysex([msg({ bytes: 'F0 {a} F7', args: [{ name: 'a', default: 1 }] })], { connect: ['prog'] })), []);
  assert.equal(sysexMessage(withSysex([msg()]), 'prog').label, 'Programmer mode');
  assert.equal(sysexMessage(base(), 'prog'), null);
});

test('a SysEx message marked verified needs its own hardware check', () => {
  const p = withSysex([msg({ verified: true })]);
  assert.match(errsOf(p), /sysex message "prog": verified is true/);
  p.verifications = [hardware({ 'sysex:prog': 'match' })];
  assert.deepEqual(validateProfile(p), []);
  p.verifications = [hardware({ 'sysex:ghost': 'match' })];
  assert.match(errsOf(p), /names "sysex:ghost"/);
});

test('the Device Inquiry reply is read, anything else is not', () => {
  const r = parseDeviceInquiry(parseHex('F0 7E 00 06 02 00 20 29 13 01 00 00 00 04 03 01 F7'));   // laid out as Novation's manual prints it
  assert.deepEqual(r.manufacturer, [0, 0x20, 0x29]);
  assert.deepEqual(r.family, [0x13, 1]);
  assert.deepEqual(r.model, [0, 0]);
  assert.deepEqual(r.version, [0, 4, 3, 1]);
  assert.equal(r.text, '0.4.3.1');
  const a = parseDeviceInquiry(parseHex('F0 7E 00 06 02 47 29 00 19 00 01 02 03 04 F7'));         // one-byte maker: AKAI's layout
  assert.deepEqual(a.manufacturer, [0x47]);
  assert.equal(parseDeviceInquiry([0x90, 60, 100]), null);
  assert.equal(parseDeviceInquiry(DEVICE_INQUIRY), null);
});

// ------------------------------------------------------------------ palette, licence, automatic layouts
test('a palette is checked, and the file-level fields too', () => {
  const pal = (over = {}) => ({ ...base(), palette: { cite: { source: 0 }, colors: [{ value: 5, name: 'Red', rgb: '#ff0000' }], ...over } });
  assert.deepEqual(validateProfile(pal({ channels: [{ ch: 1, name: 'Static' }] })), []);
  assert.match(errsOf(pal({ colors: [] })), /non-empty array/);
  assert.match(errsOf(pal({ cite: undefined })), /cite\.source/);
  assert.match(errsOf(pal({ colors: [{ value: 128, rgb: '#ff0000' }] })), /value must be 0\.\.127/);
  assert.match(errsOf(pal({ colors: [{ value: 5, rgb: 'red' }] })), /rgb must be #rrggbb/);
  assert.match(errsOf(pal({ colors: [{ value: 5, rgb: '#000000' }, { value: 5, rgb: '#111111' }] })), /appears twice/);
  assert.match(errsOf(pal({ channels: [{ ch: 17, name: 'x' }] })), /ch 1\.\.16/);
  const p = base(); p.face.auto = 'yes'; p.license = '';
  assert.match(errsOf(p), /face\.auto must be true or false/);
  assert.match(errsOf(p), /license must be an SPDX id/);
  const q = base(); q.controls[0].led = { msg: 'note', note: 1, index: 200 };
  assert.match(errsOf(q), /led\.index must be 0\.\.127/);
});

// ------------------------------------------------------------------ the JSON Schema
// A small reader for the part of JSON Schema profile.schema.json uses: no dependency, and the file stays honest.
function check(schema, v, root, at = '$', out = []) {
  if (schema.$ref) return check(schema.$ref.split('/').slice(1).reduce((s, k) => s[k], root), v, root, at, out);
  const t = schema.type;
  const is = { object: () => v && typeof v === 'object' && !Array.isArray(v), array: () => Array.isArray(v), string: () => typeof v === 'string', number: () => typeof v === 'number', integer: () => Number.isInteger(v), boolean: () => typeof v === 'boolean' };
  if (t && !is[t]()) { out.push(`${at}: not ${t}`); return out; }
  if (schema.enum && !schema.enum.includes(v)) out.push(`${at}: ${JSON.stringify(v)} not in enum`);
  if (schema.pattern && !new RegExp(schema.pattern).test(v)) out.push(`${at}: ${v} does not match ${schema.pattern}`);
  if (schema.minLength && v.length < schema.minLength) out.push(`${at}: too short`);
  if (schema.minItems && v.length < schema.minItems) out.push(`${at}: too few items`);
  if (schema.minimum !== undefined && v < schema.minimum) out.push(`${at}: below minimum`);
  if (schema.maximum !== undefined && v > schema.maximum) out.push(`${at}: above maximum`);
  if (schema.exclusiveMinimum !== undefined && v <= schema.exclusiveMinimum) out.push(`${at}: not above minimum`);
  for (const k of schema.required || []) if (!(k in v)) out.push(`${at}: missing ${k}`);
  for (const [k, s] of Object.entries(schema.properties || {})) if (v && typeof v === 'object' && k in v) check(s, v[k], root, `${at}.${k}`, out);
  if (schema.items) v.forEach((x, i) => check(schema.items, x, root, `${at}[${i}]`, out));
  if (typeof schema.additionalProperties === 'object') for (const [k, x] of Object.entries(v)) check(schema.additionalProperties, x, root, `${at}.${k}`, out);
  if (schema.oneOf) { const hits = schema.oneOf.filter((s) => !check(s, v, root, at, []).length).length; if (hits !== 1) out.push(`${at}: matches ${hits} of oneOf`); }
  return out;
}

test('profile.schema.json accepts every shipped profile and a full record, and rejects what it should', () => {
  const schema = JSON.parse(fs.readFileSync(new URL('../packages/midi/profile.schema.json', import.meta.url), 'utf8'));
  for (const p of PROFILES) assert.deepEqual(check(schema, p, schema), [], p.id);
  const p = withSysex([msg({ args: [] }), msg({ id: 'led', purpose: 'led', bytes: 'F0 03 {led} {r.msb} F7', args: [{ name: 'led' }, { name: 'r', max: 255 }] })], { connect: ['prog'] });
  p.verifications = [hardware({ [p.controls[0].id]: 'match', [p.controls[1].id]: { result: 'corrected', was: { msg: 'cc', ch: 1, cc: 1 }, led: 'match' } })];
  p.palette = { cite: { source: 0 }, colors: [{ value: 5, rgb: '#ff0000' }] };
  assert.deepEqual(check(schema, p, schema), []);
  assert.ok(check(schema, { ...p, kind: 'toy' }, schema).length, 'bad kind');
  assert.ok(check(schema, { ...p, sysex: { messages: [msg({ bytes: 'hello' })] } }, schema).length, 'bad bytes');
  assert.ok(check(schema, { ...p, verifications: [hardware({ a: 'great' })] }, schema).length, 'bad result');
  assert.ok(check(schema, { ...p, verifications: [{ date: '2026-11-12' }] }, schema).length, 'incomplete record');
});

// ------------------------------------------------------------------ asking for SysEx
const fakeAccess = (sysex) => {
  const inp = { name: 'Unit', onmidimessage: null }, out = { name: 'Unit', sent: [], send(b) { if (b[0] === 0xf0 && !sysex) throw new Error('InvalidAccessError'); this.sent.push(b); } };
  return { inputs: new Map([['i', inp]]), outputs: new Map([['o', out]]), sysexEnabled: sysex, onstatechange: null };
};

test('the engine never asks for SysEx by itself, and asks when told to', async () => {
  const { Midi } = await import('../packages/midi/index.js');
  const asked = [], accesses = [];
  const midi = new Midi({ requestAccess: async (o) => { asked.push(o); const a = fakeAccess(!!o.sysex); accesses.push(a); return a; } });
  await midi.enable();
  assert.deepEqual(asked, [{ sysex: false }], 'enable() stays without SysEx');
  assert.equal(midi.sysexEnabled, false);
  assert.throws(() => midi.sendSysex(DEVICE_INQUIRY), /requestSysex\(\) first/);
  const old = accesses[0].inputs.get('i');
  assert.ok(old.onmidimessage);

  assert.equal(await midi.requestSysex(), true);
  assert.deepEqual(asked.at(-1), { sysex: true });
  assert.equal(midi.sysexEnabled, true);
  assert.equal(old.onmidimessage, null, 'the old input lets go, so nothing arrives twice');
  assert.ok(accesses[1].inputs.get('i').onmidimessage);
  assert.equal(midi.out, accesses[1].outputs.get('o'), 'the output is the same port, from the new access');
  assert.equal(midi.sendSysex(DEVICE_INQUIRY), true);
  assert.deepEqual(accesses[1].outputs.get('o').sent, [DEVICE_INQUIRY]);
  assert.equal(await midi.requestSysex(), true); assert.equal(asked.length, 2, 'asked once');

  const refused = new Midi({ requestAccess: async (o) => { if (o.sysex) throw new Error('denied'); return fakeAccess(false); } });
  await refused.enable();
  assert.equal(await refused.requestSysex(), false);
  assert.equal(refused.sysexEnabled, false);
  assert.ok(refused.out, 'a refusal leaves the plain connection as it was');
});
