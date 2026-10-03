// @openav/remote · sensors — PhoneSensors (the /remote 感測 page) and localSensors (the show page itself on a
// phone, no relay). DOM-free: the browser bits it touches (window events, screen angle) are stubbed here.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Signals } from '../packages/core/src/signals.js';
import { PhoneSensors, localSensors } from '../packages/remote/sensors.js';

const listeners = {};
globalThis.window = {
  addEventListener: (t, fn) => { listeners[t] = fn; }, removeEventListener: (t) => { delete listeners[t]; },
  isSecureContext: true,
};
globalThis.screen = { orientation: { angle: 0 } };

test('screenTilt: a phone turned sideways still reports "tilt right = +x"', () => {
  assert.deepEqual(PhoneSensors.screenTilt(10, 20, 0), { x: 20, y: 10 });
  assert.deepEqual(PhoneSensors.screenTilt(10, 20, 90), { x: 10, y: -20 });
  assert.deepEqual(PhoneSensors.screenTilt(10, 20, -90), { x: -10, y: 20 });
});

test('localSensors: the page\'s own sensors land under phone/local/… (and phone/any/…), declared like a remote phone\'s', (t) => {
  t.mock.method(performance, 'now', () => 60000);   // a minute into the page (the knock cooldown counts from 0)
  const s = new Signals();
  const own = localSensors(s);
  own._onOrient({ alpha: 5, beta: 22.5, gamma: -45 });
  assert.equal(s.get('phone/local/tilt/x'), -1);
  assert.equal(s.get('phone/local/tilt/y'), 0.5);
  assert.equal(s.get('phone/any/tilt/x'), -1, 'mirrored like bindSignals mirrors a remote phone');
  assert.equal(s.meta.get('phone/local/tilt/x').min, -1);
  assert.equal(s.meta.get('phone/local/tilt/x').source, 'local');
  own._onMotion({ accelerationIncludingGravity: { x: 0, y: 0, z: 9.8 }, rotationRate: { alpha: 1, beta: 2, gamma: 3 } });
  own._onMotion({ accelerationIncludingGravity: { x: 15, y: 0, z: 9.8 }, rotationRate: null });   // a 15 m/s² jolt
  assert.equal(s.meta.get('phone/local/knock').kind, 'pulse');
  const k = s.get('phone/local/knock');
  assert.ok(k.strength > 0.15 && k.strength <= 1 && k.delta === 15, JSON.stringify(k));
  assert.equal(s.get('phone/local/rot/gamma'), 3);
});

test('localSensors: alias off and a custom prefix/source (how the lab wires it)', () => {
  const s = new Signals();
  const own = localSensors(s, { prefix: 'phone/local/', alias: null, source: 'motion' });
  own._onOrient({ alpha: 0, beta: 0, gamma: 9 });
  assert.equal(s.get('phone/local/tilt/x'), 0.2);
  assert.equal(s.meta.has('phone/any/tilt/x'), false);
  assert.equal(s.meta.get('phone/local/tilt/x').source, 'motion');
});

test('start(): iOS permission denied → .denied, listeners still attached (touch keeps working)', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const notes = [];
  window.DeviceMotionEvent = { requestPermission: async () => 'denied' };
  window.DeviceOrientationEvent = { requestPermission: async () => 'granted' };
  const ps = new PhoneSensors({ set() {}, send() {} }, { notify: (m) => notes.push(m) });
  assert.equal(await ps.start(), true);
  assert.equal(ps.denied, true);
  assert.equal(typeof listeners.devicemotion, 'function');
  assert.match(notes[0], /授權被拒絕/);
  ps.stop();
  const ok = new PhoneSensors({ set() {}, send() {} });
  window.DeviceMotionEvent = { requestPermission: async () => 'granted' };
  await ok.start(); assert.equal(ok.denied, false); ok.stop();
  delete window.DeviceMotionEvent; delete window.DeviceOrientationEvent;
});
