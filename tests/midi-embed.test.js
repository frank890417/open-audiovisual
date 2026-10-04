// Embedding the controllers: <oav-controller> attributes, the `control` event payload,
// profiles by id / URL, the iframe postMessage protocol, MIDI out (bytes for every
// control of every shipped profile), hardware via a fake Web MIDI — all without a browser.
// The element itself is a thin DOM shell over createController(), exercised in the browser.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseEmbedOptions, embedFlag, embedMode, embedChannel, embedColor, resolveProfile, isProfileUrl, withChannel, findPort,
  controlDetail, describeDetail, setControl, valuesOf, preferredAspect, toParent, fromFrame, toFrame, fromParent, EMBED_EVENTS, FRAME_COMMANDS,
} from '../packages/midi/embed.js';
import { createController, ControllerHost, loadProfile, Midi } from '../packages/midi/index.js';
import { parseMessage } from '../packages/midi/parse.js';
import { PROFILES, profileById } from '../packages/midi/profiles/index.js';
import { normalizeProfile } from '../packages/midi/profiles.js';
import { MidiController } from '../packages/midi/controller.js';

const P = (id) => profileById(id);
const noStore = { getItem: () => null, setItem: () => {} };

// a fake Web MIDI (same shape as tests/midi-controllers.test.js)
function fakePort(name, type = 'input') {
  return { id: name + '-' + type, name, type, state: 'connected', connection: 'open', manufacturer: 'fake', onmidimessage: null, sent: [],
    send(b) { this.sent.push(Array.from(b)); }, play(bytes) { this.onmidimessage?.({ data: Uint8Array.from(bytes) }); } };
}
function fakeAccess(ins = [], outs = []) {
  const a = { inputs: new Map(ins.map((p) => [p.id, p])), outputs: new Map(outs.map((p) => [p.id, p])), onstatechange: null, sysexEnabled: false };
  a.plug = (p) => { (p.type === 'input' ? a.inputs : a.outputs).set(p.id, p); a.onstatechange?.({ port: p }); };
  a.unplug = (p) => { (p.type === 'input' ? a.inputs : a.outputs).delete(p.id); a.onstatechange?.({ port: p }); };
  return a;
}
const collect = (host, ...names) => { const log = []; for (const n of names) host.on(n, (d) => log.push([n, d])); return log; };

// ------------------------------------------------------------------ attributes
test('attributes: flags, modes, channel, layout, theme — from an element, a query string or an object', () => {
  assert.equal(embedFlag(''), true); assert.equal(embedFlag('false'), false); assert.equal(embedFlag('off'), false); assert.equal(embedFlag(null), false); assert.equal(embedFlag('yes'), true);
  assert.deepEqual(embedMode(''), { mode: 'on', port: null });
  assert.deepEqual(embedMode('ask'), { mode: 'ask', port: null });
  assert.deepEqual(embedMode('LPD8'), { mode: 'on', port: 'LPD8' });
  assert.deepEqual(embedMode(null), { mode: 'off', port: null });
  assert.deepEqual(embedMode('', { bare: 'ask' }), { mode: 'ask', port: null });
  assert.equal(embedChannel('10'), 10); assert.equal(embedChannel('0'), null); assert.equal(embedChannel('17'), null); assert.equal(embedChannel('x'), null);
  assert.equal(embedColor('transparent'), 'transparent'); assert.equal(embedColor('000'), '#000'); assert.equal(embedColor('#0b0b0c'), '#0b0b0c');
  assert.equal(embedColor('red;}body{'), null); assert.equal(embedColor('#12345'), null);

  const attrs = { profile: 'akai-lpd8', layout: 'stack', hardware: 'ask', 'midi-out': 'IAC', channel: '2', picker: '', readout: '', theme: 'light' };
  const el = { getAttribute: (n) => (n in attrs ? attrs[n] : null) };
  const o = parseEmbedOptions(el);
  assert.equal(o.profile, 'akai-lpd8'); assert.equal(o.layout, 'stack');
  assert.deepEqual(o.hardware, { mode: 'ask', port: null }); assert.deepEqual(o.midiOut, { mode: 'on', port: 'IAC' });
  assert.equal(o.channel, 2); assert.equal(o.picker, true); assert.equal(o.readout, true); assert.equal(o.learn, false); assert.equal(o.theme, 'light');

  const q = parseEmbedOptions(new URLSearchParams('profile=lpd8&layout=sideways&midi-out&learn&bg=transparent&frame=pads&origin=https://example.com&hardware=off'));
  assert.equal(q.profile, 'lpd8'); assert.equal(q.layout, 'auto', 'unknown layout falls back');
  assert.deepEqual(q.midiOut, { mode: 'ask', port: null }, 'bare midi-out asks');
  assert.deepEqual(q.hardware, { mode: 'off', port: null });
  assert.equal(q.learn, true); assert.equal(q.bg, 'transparent'); assert.equal(q.frame, 'pads'); assert.equal(q.origin, 'https://example.com');
  assert.equal(parseEmbedOptions(new URLSearchParams('origin=javascript:alert(1)')).origin, null);

  const d = parseEmbedOptions({});
  assert.equal(d.profile, 'arturia-minilab3'); assert.equal(d.hardware.mode, 'off', 'never prompts unless asked'); assert.equal(d.midiOut.mode, 'off'); assert.equal(d.theme, 'dark');
});

// ------------------------------------------------------------------ profiles
test('profiles by id, short name or URL; a bad file says why', async () => {
  assert.equal((await resolveProfile('akai-lpd8', { profiles: PROFILES })).id, 'akai-lpd8');
  assert.equal((await resolveProfile('nano2', { profiles: PROFILES })).id, 'korg-nanokontrol2');
  await assert.rejects(resolveProfile('akai-mpk-mini', { profiles: PROFILES }), /unknown MIDI profile "akai-mpk-mini" \(known: arturia-minilab3/);
  assert.ok(isProfileUrl('https://x.org/my.json')); assert.ok(isProfileUrl('./pads.json')); assert.ok(isProfileUrl('/p/x')); assert.ok(!isProfileUrl('akai-lpd8'));

  const mine = { ...structuredClone(P('akai-lpd8')), id: 'my-lpd8', short: 'mylpd8', name: 'My LPD8' };
  const asked = [];
  const fetch = async (url) => { asked.push(url); return url.endsWith('my-lpd8.json') ? { ok: true, json: async () => mine } : url.endsWith('bad.json') ? { ok: true, json: async () => ({ id: 'Bad' }) } : { ok: false, status: 404 }; };
  const got = await resolveProfile('./profiles/my-lpd8.json', { profiles: PROFILES, fetch, base: 'https://example.com/show/' });
  assert.equal(got.id, 'my-lpd8');
  assert.deepEqual(asked, ['https://example.com/show/profiles/my-lpd8.json']);
  await assert.rejects(resolveProfile('https://x.org/bad.json', { profiles: PROFILES, fetch }), /invalid MIDI profile[\s\S]*id "Bad"[\s\S]*missing name/);
  await assert.rejects(resolveProfile('https://x.org/gone.json', { profiles: PROFILES, fetch }), /404/);
  assert.equal((await loadProfile('lpmini')).id, 'novation-launchpad-mini-mk3');
});

test('channel override moves every control (your unit is set to another channel)', () => {
  const p = withChannel(P('akai-lpd8'), 3);
  assert.ok(p.controls.every((c) => c.ch === 3));
  assert.equal(P('akai-lpd8').controls[0].ch, 10, 'the shipped profile is untouched');
  const host = createController('akai-lpd8', { channel: 3, storage: noStore });
  assert.deepEqual(host.set('k1', 1), [0xb2, 70, 127]);
  assert.deepEqual(host.set('pad1', 1), [0x92, 36, 127]);
  host.dispose();
});

test('findPort: /regex/, exact name, then substring (case-insensitive)', () => {
  const ports = [{ name: 'IAC Driver Bus 1' }, { name: 'loopMIDI Port' }, { name: 'Minilab3 MIDI' }];
  assert.equal(findPort(ports, 'IAC').name, 'IAC Driver Bus 1');
  assert.equal(findPort(ports, 'loopmidi').name, 'loopMIDI Port');
  assert.equal(findPort(ports, '/^mini/').name, 'Minilab3 MIDI');
  assert.equal(findPort(ports, 'Minilab3 MIDI').name, 'Minilab3 MIDI');
  assert.equal(findPort(ports, 'nanoKONTROL'), null);
  assert.equal(findPort(ports, '/[/'), null, 'a broken regex finds nothing instead of throwing');
});

// ------------------------------------------------------------------ the control event
test('control event payload: the documented shape, for a knob turned on screen', () => {
  const host = createController('arturia-minilab3', { storage: noStore });
  const log = collect(host, 'control');
  host.set('knob1', 0.42);
  assert.equal(log.length, 1);
  const d = log[0][1];
  assert.deepEqual(Object.keys(d).sort(), ['bytes', 'id', 'label', 'message', 'profile', 'raw', 'signal', 'source', 'time', 'type', 'value'].sort());
  assert.equal(d.profile, 'arturia-minilab3'); assert.equal(d.id, 'knob1'); assert.equal(d.type, 'knob');
  assert.equal(d.raw, 53); assert.equal(d.value, 53 / 127);
  assert.equal(d.signal, 'midi/minilab3/knob1');
  assert.deepEqual(d.message, { type: 'cc', ch: 1, cc: 74, value: 53 });
  assert.deepEqual(d.bytes, [0xb0, 74, 53]);
  assert.equal(d.source, 'ui');
  assert.equal(describeDetail(d), 'midi/minilab3/knob1 = 0.42 ← CC 74 = 53 · ch 1');
  assert.deepEqual(JSON.parse(JSON.stringify(d)), d, 'payload is plain JSON (postMessage-safe)');
  host.dispose();
});

test('payloads for pads, keys, pitch, encoders and buttons; noteon/noteoff events', () => {
  const host = createController('arturia-minilab3', { storage: noStore });
  const log = collect(host, 'control', 'noteon', 'noteoff');
  host.set('pad3', 0.5);
  const [[, pad], [n1, on]] = log;
  assert.equal(n1, 'noteon');
  assert.deepEqual([pad.type, pad.value, pad.raw, pad.note, pad.velocity, pad.held, pad.signal], ['pad', 64 / 127, 64, 38, 64, true, 'midi/minilab3/pad3']);
  assert.deepEqual(pad.message, { type: 'noteon', ch: 10, note: 38, vel: 64 });
  assert.equal(on, pad);
  host.set('pad3', 0);
  assert.equal(log.at(-1)[0], 'noteoff'); assert.equal(log.at(-1)[1].value, 0); assert.equal(log.at(-1)[1].held, false);

  log.length = 0;
  host.set('keys', 1, { note: 60 });
  assert.deepEqual([log[0][1].signal, log[0][1].note, log[0][1].value, log[0][1].bytes], ['midi/minilab3/n60', 60, 1, [0x90, 60, 127]]);
  host.set('keys', 0, { note: 60 });
  assert.deepEqual([log.at(-1)[0], log.at(-1)[1].value, log.at(-1)[1].bytes], ['noteoff', 0, [0x80, 60, 0]]);

  log.length = 0;
  host.set('pitch', 1);
  assert.deepEqual([log[0][1].value, log[0][1].raw, log[0][1].bytes], [1, 16383, [0xe0, 0x7f, 0x7f]]);
  assert.equal(describeDetail(log[0][1]), 'midi/minilab3/pitch = 1.00 ← Bend 16383 · ch 1');

  log.length = 0;
  host.controller.turn('enc', 3);
  assert.equal(log[0][1].delta, 3); assert.deepEqual(log[0][1].bytes, [0xb0, 28, 67]);
  host.dispose();

  const nano = createController('korg-nanokontrol2', { storage: noStore });
  const nl = collect(nano, 'control');
  nano.set('play', 1); nano.set('play', 0);
  assert.deepEqual(nl.map(([, d]) => [d.value, d.held, d.bytes]), [[1, true, [0xb0, 41, 127]], [0, false, [0xb0, 41, 0]]]);
  nano.dispose();
});

test('quiet set moves the faceplate only; ingest is "hardware"; values / get / reset', () => {
  const host = createController('akai-lpd8', { storage: noStore });
  const log = collect(host, 'control');
  host.set('k2', 1, { quiet: true });
  assert.equal(log.length, 0); assert.equal(host.get('k2'), 1);
  host.ingest([0xb0, 72, 64]);
  assert.equal(log.at(-1)[1].source, 'hardware'); assert.equal(log.at(-1)[1].id, 'k3');
  host.ingest([[0x99, 36, 100], [0x89, 36, 0]]);
  assert.deepEqual(log.slice(-2).map(([, d]) => [d.id, d.value > 0]), [['pad1', true], ['pad1', false]]);
  const v = host.values();
  assert.equal(Object.keys(v).length, 16); assert.equal(v.k3, 64 / 127);
  host.reset();
  assert.ok(Object.values(host.values()).every((x) => x === 0));
  assert.equal(host.get('nope'), null);
  assert.throws(() => host.set('nope', 1), /has no control "nope" \(controls: pad1/);
  assert.throws(() => host.set('k1', 'loud'), /must be a number/);
  host.dispose();
});

// ------------------------------------------------------------------ MIDI out
test('MIDI out: every control of every profile sends the message its profile documents', async () => {
  for (const raw of PROFILES) {
    const iac = fakePort('IAC Driver Bus 1', 'output');
    const host = createController(raw.id, { storage: noStore, requestAccess: async () => fakeAccess([], [iac]) });
    assert.equal(await host.setOutput('IAC'), 'IAC Driver Bus 1', raw.id);
    const p = normalizeProfile(raw);
    for (const c of p.controls) {
      iac.sent.length = 0;
      const note = c.type === 'keys' ? c.from + 2 : null;
      host.set(c.id, c.bipolar ? -1 : 1, { note });
      assert.ok(iac.sent.length >= 1, `${raw.id}/${c.id} sent nothing`);
      const ev = parseMessage(iac.sent[0]);
      const at = `${raw.id}/${c.id}`;
      assert.equal(ev.ch, c.ch, at + ' channel');
      if (c.msg === 'cc') { assert.equal(ev.type, 'cc', at); assert.equal(ev.cc, c.cc, at); }
      else if (c.msg === 'note') { assert.equal(ev.type, 'noteon', at); assert.equal(ev.note, c.type === 'keys' ? note : c.note, at); }
      else assert.equal(ev.type, c.msg, at);
      // and back: pads, momentary buttons and keys let go
      if (c.type === 'pad' || c.type === 'keys' || (c.type === 'button' && c.mode !== 'toggle')) {
        iac.sent.length = 0;
        host.set(c.id, 0, { note });
        const off = parseMessage(iac.sent[0]);
        assert.ok(off.type === 'noteoff' || (off.type === 'cc' && off.value === 0), at + ' release');
      }
    }
    host.dispose();
  }
});

test('MIDI out: hardware moves are not forwarded, the loopback input is muted, dispose sends note-offs', async () => {
  const lpd = fakePort('LPD8 mk2'), loopIn = fakePort('loopMIDI Port'), loopOut = fakePort('loopMIDI Port', 'output');
  const access = fakeAccess([lpd, loopIn], [loopOut]);
  const host = createController('akai-lpd8', { storage: noStore, requestAccess: async () => access });
  const log = collect(host, 'control', 'connect', 'status');
  assert.equal(await host.connectHardware(), true);
  assert.equal(log.find(([n]) => n === 'connect')[1].port, 'LPD8 mk2');
  assert.equal(host.status.hardware, 'connected');
  await host.setOutput('loopMIDI');
  assert.equal(host.status.output, 'loopMIDI Port'); assert.equal(host.status.outputState, 'open');
  assert.equal(host.midi.devices().find((d) => d.name === 'loopMIDI Port').listening, false, 'our own cable is never listened to');
  lpd.play([0xb0, 70, 99]);                                       // the real knob: event yes, forward no
  const hw = log.filter(([n]) => n === 'control').at(-1)[1];
  assert.deepEqual([hw.id, hw.source, hw.raw], ['k1', 'hardware', 99]);
  assert.equal(loopOut.sent.length, 0, 'your DAW already hears the device');
  host.set('pad2', 1);                                            // a finger on screen: forwarded
  assert.deepEqual(loopOut.sent, [[0x99, 37, 127]]);
  host.dispose();
  assert.deepEqual(loopOut.sent.at(-1), [0x89, 37, 0], 'a held pad is released before the controller goes away');
  assert.equal(lpd.onmidimessage, null, 'no listener left on the port');
});

test('IAC is filtered by the engine (Midi filterOut default): sending into the bus never comes back', async () => {
  const iacIn = fakePort('IAC Driver Bus 1'), iacOut = fakePort('IAC Driver Bus 1', 'output');
  const midi = new Midi({ requestAccess: async () => fakeAccess([iacIn], [iacOut]) });
  await midi.enable();
  assert.deepEqual(midi.devices(), [], 'the IAC input is not even listed');
  const host = createController('akai-lpd8', { storage: noStore, midi });
  await host.setOutput('IAC');
  const log = collect(host, 'control');
  host.set('k1', 0.5);
  iacIn.play(iacOut.sent[0]);                                     // the DAW echoes it back
  assert.equal(log.length, 1, 'only the play itself, no echo');
  host.dispose();
});

// ------------------------------------------------------------------ hardware
test('hardware: plug in → connect, unplug → disconnect; follow switches to the device you plug in', async () => {
  const access = fakeAccess();
  const host = createController('akai-lpd8', { storage: noStore, follow: true, requestAccess: async () => access });
  const log = collect(host, 'connect', 'disconnect', 'profilechange');
  await host.connectHardware();
  assert.equal(host.status.hardware, 'waiting');
  const ml = fakePort('Minilab3 MIDI'); access.plug(ml);
  assert.equal(host.profileId, 'arturia-minilab3', 'follow: the plugged device is shown');
  assert.deepEqual(log.map(([n, d]) => [n, d.profile]), [['profilechange', 'arturia-minilab3'], ['connect', 'arturia-minilab3']]);
  access.unplug(ml);
  assert.deepEqual(log.at(-1), ['disconnect', { port: 'Minilab3 MIDI', profile: 'arturia-minilab3' }]);
  host.dispose();

  const fixed = createController('akai-lpd8', { storage: noStore, requestAccess: async () => fakeAccess([fakePort('Minilab3 MIDI')]) });
  await fixed.connectHardware();
  assert.equal(fixed.profileId, 'akai-lpd8', 'without follow an LPD8 embed stays an LPD8');
  assert.equal(fixed.status.hardware, 'waiting');
  fixed.dispose();
});

test('hardware: a generic layout takes an unknown device (auto-learn), or a port named by hand', async () => {
  const box = fakePort('Weird Box');
  const host = createController('generic-8k8p', { storage: noStore, requestAccess: async () => fakeAccess([box]) });
  const log = collect(host, 'control');
  await host.connectHardware();
  assert.equal(host.status.input, 'Weird Box');
  box.play([0xb5, 21, 64]);
  assert.deepEqual([log[0][1].id, log[0][1].source], ['k1', 'hardware']);
  host.dispose();

  const renamed = fakePort('USB MIDI Device');
  const h2 = createController('akai-lpd8', { storage: noStore, requestAccess: async () => fakeAccess([renamed]) });
  await h2.connectHardware('USB MIDI');
  assert.equal(h2.status.hardware, 'connected');
  h2.dispose();
});

test('no Web MIDI (Safari, iPad): status says so, the controller still plays and fires events', async () => {
  const host = createController('akai-lpd8', { storage: noStore, requestAccess: async () => { throw new Error('no Web MIDI'); } });
  const log = collect(host, 'control');
  assert.equal(await host.connectHardware(), false);
  assert.equal(host.status.hardware, 'denied');
  assert.equal(await host.setOutput('IAC'), null);
  host.set('pad1', 1);
  assert.equal(log.length, 1);
  host.dispose();
  const bare = new ControllerHost('lpd8', { storage: noStore });   // default engine, no navigator in node
  assert.equal(await bare.connectHardware(), false);
  assert.equal(bare.status.hardware, 'unavailable');
  bare.dispose();
});

test('setProfile: by id, by URL-loaded object; channel override follows', async () => {
  const host = createController('akai-lpd8', { storage: noStore, channel: 5 });
  const log = collect(host, 'profilechange');
  await host.setProfile('nano2');
  assert.equal(host.profileId, 'korg-nanokontrol2');
  assert.ok(host.profile.controls.every((c) => c.ch === 5));
  const mine = { ...structuredClone(P('generic-8f')), id: 'my-faders', short: 'myf', name: 'My faders' };
  await host.setProfile(mine);
  assert.equal(host.profileId, 'my-faders');
  assert.deepEqual(log.map(([, d]) => d.profile), ['korg-nanokontrol2', 'my-faders']);
  host.dispose();
});

// ------------------------------------------------------------------ helpers
test('setControl per type; valuesOf; detail from a bare controller', () => {
  const c = new MidiController(P('korg-nanokontrol2'), { sink: () => {} });
  const t = structuredClone(P('korg-nanokontrol2')); t.controls.find((x) => x.id === 's1').mode = 'toggle';
  const tc = new MidiController(t, { sink: () => {} });
  assert.deepEqual(setControl(tc, 's1', 1), [0xb0, 32, 127]);
  assert.equal(setControl(tc, 's1', 1), null, 'already on');
  assert.deepEqual(setControl(tc, 's1', 0), [0xb0, 32, 0]);
  assert.deepEqual(setControl(c, 'f1', 0.5), [0xb0, 0, 64]);
  assert.equal(valuesOf(c).f1, 64 / 127);
  const st = c.get('f1');
  const d = controlDetail(c, 'f1', st, { source: 'hw', ev: { type: 'cc', ch: 1, cc: 0, value: 64 } });
  assert.equal(d.source, 'hardware'); assert.deepEqual(d.bytes, [0xb0, 0, 64]);
});

test('preferredAspect: the faceplate when it fits, a taller stack on a phone, Launchpad stays square', () => {
  const lpd = normalizeProfile(P('akai-lpd8'));
  assert.equal(preferredAspect(lpd, 1200).mode, 'face');
  assert.ok(Math.abs(preferredAspect(lpd, 1200).aspect - 100 / 27) < 1e-9);
  const phone = preferredAspect(lpd, 340);
  assert.equal(phone.mode, 'stack'); assert.ok(phone.aspect <= 1.25, 'taller than wide-ish on a phone');
  assert.equal(preferredAspect(lpd, 340, { layout: 'face' }).mode, 'face');
  const lp = normalizeProfile(P('lpmini'));
  assert.deepEqual(preferredAspect(lp, 300), { mode: 'face', aspect: 1 });
  for (const p of PROFILES.map(normalizeProfile)) for (const w of [320, 390, 768, 1440]) {
    const a = preferredAspect(p, w).aspect;
    assert.ok(a > 0.5 && a < 6, `${p.id} @${w}: ${a}`);
  }
});

// ------------------------------------------------------------------ postMessage
test('postMessage protocol: iframe → page and page → iframe, validated both ways', () => {
  const host = createController('akai-lpd8', { storage: noStore });
  let d = null; host.on('control', (x) => { d = x; });
  host.set('k1', 1);
  const msg = toParent('control', d, { frame: 'pads' });
  assert.deepEqual(Object.keys(msg), ['source', 'v', 'type', 'frame', 'detail']);
  assert.equal(msg.source, 'openav'); assert.equal(msg.type, 'control');
  const back = fromFrame(structuredClone(msg));
  assert.deepEqual([back.type, back.frame, back.detail.signal, back.detail.value], ['control', 'pads', 'midi/lpd8/k1', 1]);
  assert.equal(fromFrame({ type: 'control' }), null); assert.equal(fromFrame('hello'), null);

  assert.deepEqual(fromParent(toFrame('set', { id: 'k1', value: 0.5 })), { type: 'set', id: 'k1', value: 0.5, note: null, quiet: false });
  assert.deepEqual(fromParent(toFrame('set', { id: 'keys', value: 1, note: 60, quiet: true })), { type: 'set', id: 'keys', value: 1, note: 60, quiet: true });
  assert.deepEqual(fromParent(toFrame('ingest', { bytes: [0xb0, 70, 3] })), { type: 'ingest', bytes: [0xb0, 70, 3] });
  assert.deepEqual(fromParent(toFrame('ingest', { bytes: [[0x99, 36, 9], [0x89, 36, 0]] })).bytes.length, 2);
  assert.deepEqual(fromParent(toFrame('profile', { profile: 'korg-nanokontrol2' })), { type: 'profile', profile: 'korg-nanokontrol2' });
  assert.deepEqual(fromParent(toFrame('layout', { layout: 'stack' })), { type: 'layout', layout: 'stack' });
  assert.deepEqual(fromParent(toFrame('press', { id: 'pad1', velocity: 2 })), { type: 'press', id: 'pad1', velocity: 1, note: null });
  for (const bad of [null, {}, { target: 'openav', type: 'eval' }, toFrame('set', { id: 'k1' }), toFrame('set', { id: '<img>', value: 1 }),
    toFrame('ingest', { bytes: [70, 3] }), toFrame('ingest', { bytes: [0xb0, 300, 1] }), toFrame('ingest', { bytes: 'b0 46 03' }),
    toFrame('profile', { profile: 'javascript:alert(1)' }), toFrame('layout', { layout: 'sideways' }), { source: 'openav', type: 'set', id: 'k1', value: 1 }]) {
    assert.equal(fromParent(bad), null, JSON.stringify(bad));
  }
  assert.ok(FRAME_COMMANDS.includes('get')); assert.ok(EMBED_EVENTS.includes('control'));
  host.dispose();
});
