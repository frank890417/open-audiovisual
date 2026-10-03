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

/** Wire a runner-side RelayClient into a Signals registry.
 *  Returns an unsubscribe function. */
export function bindSignals(client, signals, { alias = 'any', meta = signalMeta } = {}) {
  const apply = (name, value, pulse) => {
    if (typeof name !== 'string' || name.length > 128) return;
    if (!signals.meta.has(name)) { const d = meta(name, { pulse }); if (d) signals.define(name, d); }
    if (pulse) signals.pulse(name, value); else signals.set(name, value);
  };
  const prev = client.onSignal;
  client.onSignal = (name, value, msg) => {
    const pulse = !!msg?.pulse || signals.meta.get(name)?.kind === 'pulse';
    apply(name, value, pulse);
    const a = alias && aliasOf(name, alias);
    if (a) apply(a, value, pulse);
    prev?.(name, value, msg);
  };
  return () => { client.onSignal = prev; };
}
