// @openav/relay · signals — what travels over the relay, and how the receiving
// end declares it. Pure (no DOM, no sockets) so it is unit-testable.

/** Declared ranges/kinds for the names phones and surfaces publish.
 *  Without declarations the Mapper's "learn" cannot tell a knob from a pulse and
 *  meters cannot scale — so the runner defines every name the first time it
 *  hears it. Returns null for names it knows nothing about (auto-defined later). */
export function signalMeta(name, { pulse = false } = {}) {
  if (pulse) return { kind: 'pulse' };
  let m;
  if ((m = /^phone\/[^/]+\/(.+)$/.exec(name))) {
    const r = m[1];
    if (/^tilt\//.test(r)) return { min: -1, max: 1 };
    if (/^accel\//.test(r)) return { min: -20, max: 20, unit: 'm/s²' };
    if (/^rot\//.test(r)) return { min: -360, max: 360, unit: '°/s' };
    if (/^orient\//.test(r)) return { min: 0, max: 360, unit: '°' };
    if (r === 'knock') return { kind: 'pulse' };
    if (r === 'touch/count') return { min: 0, max: 10 };
    return { min: 0, max: 1 };             // touch/x,y,down · light
  }
  if (/^surface\//.test(name)) return /\/raw$|\/delta$/.test(name) ? {} : { min: 0, max: 1 };
  if (name === 'midi/note/on' || name === 'midi/note/off' || name === 'midi/virtual') return { kind: 'pulse' };
  if (/^midi\/[^/]+\/(?:[^/]+\/)?(?:hit|on|off|last)$/.test(name)) return { kind: 'pulse' };   // controller pulses (packages/midi)
  if (/^midi\/[^/]+\/[^/]+\/raw$/.test(name)) return {};
  if (/^midi\/cc\//.test(name)) return { min: 0, max: 1 };
  return null;
}

/** "Latest phone" alias: `phone/ab12/tilt/x` is also published as `phone/any/tilt/x`.
 *  A route in a World file cannot know a stranger's deviceId; the alias is what
 *  lets `{source:'phone/any/tilt/x', target:'hue'}` be written at author time. */
export function aliasOf(name, alias = 'any') {
  const m = /^phone\/([^/]+)\/(.+)$/.exec(name);
  if (!m || m[1] === alias) return null;
  return `phone/${alias}/${m[2]}`;
}

/** A struck note carries BOTH velocity spellings: `vel` 0..1 (what @openav/midi publishes) and
 *  `velocity` 1..127 (a hardware keyboard's own scale). Senders give one or both — an old phone page,
 *  a TouchOSC bridge, a sequencer — and a sketch is written against one of them, so the receiving end
 *  fills in whichever is missing. Every other name passes through untouched. */
const NOTE_RE = /^midi\/(?:[^/]+\/)?note\/(?:on|off)$/;
export function normalizeValue(name, value) {
  if (!value || typeof value !== 'object' || !NOTE_RE.test(name)) return value;
  if (value.vel == null && value.velocity != null) return { ...value, vel: value.velocity / 127 };
  if (value.velocity == null && value.vel != null) return { ...value, velocity: Math.round(value.vel * 127) };
  return value;
}

/** File ONE incoming signal into a Signals registry — the receiving half of the wire format.
 *  Declares the name the first time it is heard (signalMeta: a pulse is never mistaken for a knob,
 *  meters get their range), normalizes the payload, then pulses or sets. Used by bindSignals, by
 *  localSensors (the show page's own phone sensors), and by hosts that run their own socket (the lab's
 *  runtime/lab.js) so every receiver files the same message the same way. Returns false for a bad name. */
export function fileSignal(signals, name, value, { pulse = false, meta = signalMeta, source = '' } = {}) {
  if (typeof name !== 'string' || !name || name.length > 128) return false;
  if (!signals.meta.has(name)) { const d = meta(name, { pulse }); if (d) signals.define(name, source ? { ...d, source } : d); }
  const v = normalizeValue(name, value);
  if (pulse || signals.meta.get(name)?.kind === 'pulse') signals.pulse(name, v); else signals.set(name, v);
  return true;
}

/** Wire a runner-side RelayClient into a Signals registry.
 *  Returns an unsubscribe function. */
export function bindSignals(client, signals, { alias = 'any', meta = signalMeta } = {}) {
  const prev = client.onSignal;
  client.onSignal = (name, value, msg) => {
    const pulse = !!msg?.pulse || signals.meta.get(name)?.kind === 'pulse';
    fileSignal(signals, name, value, { pulse, meta });
    const a = alias && aliasOf(name, alias);
    if (a) fileSignal(signals, a, value, { pulse, meta });
    prev?.(name, value, msg);
  };
  return () => { client.onSignal = prev; };
}
