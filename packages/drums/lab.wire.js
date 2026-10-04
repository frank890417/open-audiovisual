// lab.wire.js — @openav/drums in the cheyuwu-lab runtime (contract: packages/mapping/lab.wire.js).
// Pads and drum machines speak General MIDI on channel 10; @openav/sound deliberately leaves that
// channel alone (drumChannel), so without this a pad hit is silent in the lab.
const engine = drumEngine();
let ready = false, starting = null;
const start = () => starting || (starting = engine.enable().then(() => { ready = true; }, (e) => { starting = null; throw e; }));
const hit = (what, vel = 0.9) => {
  const note = typeof what === 'number' ? what : GM[what];
  if (note == null) { console.warn('[lab:drums] unknown drum "' + what + '" — known: ' + Object.keys(GM).join(', ')); return; }
  if (ready) engine.noteOn(note, vel); else start().then(() => engine.noteOn(note, vel)).catch((e) => console.warn('[lab:drums]', e));
};
lab.drums = { engine, hit, start, GM, voices: Object.keys(GM), channel: 10, voiceForNote, set: (k, v) => engine.set(k, v) };
lab.signals.on('midi/note/on', ({ note, vel, ch }) => { if (ch === 10) hit(note, vel ?? 0.8); });
// Audio already allowed → start without waiting for a gesture (same as @openav/sound's lab.wire.js; both share
// window.__oavAudioOK so the page probes once). Chrome keeps "this frame was clicked" across a same-origin reload — the lab
// workbench reloads the work frame on every save — and an autoplay allowlist counts too: a fresh AudioContext is then
// already 'running'. When it isn't allowed, don't call start(): Tone.start() would wait forever and a later click can't
// rescue that promise.
const audioAllowed = () => {
  if (window.__oavAudioOK !== undefined) return window.__oavAudioOK;
  let ok = false;
  try {
    const pol = navigator.getAutoplayPolicy?.('audiocontext');
    if (pol) ok = pol === 'allowed';
    else { const C = window.AudioContext || window.webkitAudioContext; if (C) { const c = new C(); ok = c.state === 'running'; c.close?.().catch(() => {}); } }
  } catch { ok = false; }
  return (window.__oavAudioOK = ok);
};
const first = () => { start().catch((e) => console.warn('[lab:drums]', e)); };
if (audioAllowed()) first();
// otherwise the first gesture starts audio (browser autoplay policy)
addEventListener('pointerdown', first, { once: true });
addEventListener('keydown', first, { once: true });
