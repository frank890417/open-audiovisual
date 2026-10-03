// lab.motion.wire.js — "motion" in the cheyuwu-lab runtime (declared in packages/remote/package.json → "lab").
// Runs inside the lab's generated runtime/modules/motion.js, with `lab` (window.lab) and every export of the
// declared files in scope. Not an ES module: no import/export, no top-level return.
//
// What a work gets from `"modules": ["motion"]`: when the run page ITSELF is open on a phone, the phone's own
// DeviceMotion/Orientation arrive as phone/local/… (localSensors, no relay) — the same names a remote phone uses,
// so lab.phone.* and lab.on('phone/*/tilt', …) need no change. iOS asks on a tap: a "📱 動作感測" button
// (HTTPS only, i.e. the tunnel URL). lab.enableMotion() is the same thing from code.
(() => {
  lab.uses.add('motion');
  // alias off: lab.phone follows the latest phone/<id>/… and "any" would read as one more phone
  const sensors = localSensors(lab.signals, { prefix: 'phone/local/', alias: null, source: 'motion',
    hooks: { notify: (msg) => console.info('[lab:motion]', msg) } });
  lab.motion = sensors;
  lab.enableMotion = async () => {
    await sensors.start();
    if (sensors.denied) throw new Error('motion permission denied');   // lab.ui.button shows "再點一次"
    return true;
  };
  if (typeof DeviceMotionEvent !== 'undefined' && 'ontouchstart' in window) {
    if (typeof DeviceMotionEvent.requestPermission === 'function') lab.ui.button('📱 動作感測', lab.enableMotion);
    else sensors.start();                                              // Android: no prompt, just listen
  }
})();
