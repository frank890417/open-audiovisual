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
// first gesture starts audio (browser autoplay policy)
const first = () => { start().catch((e) => console.warn('[lab:drums]', e)); };
addEventListener('pointerdown', first, { once: true });
addEventListener('keydown', first, { once: true });
