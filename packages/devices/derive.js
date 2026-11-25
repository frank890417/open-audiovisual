// @openav/devices · derive — a device record read off a file that already describes the device.
//
// The MIDI profiles, the DMX fixtures and the parts of the electronics library stay where they are and stay the only place
// their facts are written: these functions read one of them and return its outer record (open-audiovisual/device@1),
// adding nothing the file does not say. tools/build-devices.mjs runs them over every file to write catalog.js (what
// devices() lists), and device() runs the same function on the one file it loads, so the list and the record cannot
// disagree. Pure: no imports but the record module, no DOM.

import { DEVICE_FORMAT } from './record.js?v=7229c5d3';

const uniq = (list) => [...new Set(list.filter((x) => typeof x === 'string' && x.trim() !== ''))];
const pick = (o, keys) => Object.fromEntries(keys.filter((k) => o[k] !== undefined && o[k] !== null && o[k] !== '').map((k) => [k, o[k]]));
const SOURCE_KEYS = ['title', 'url', 'note', 'license'];
const SITTING_KEYS = ['date', 'by', 'method', 'firmware', 'os', 'browser', 'note'];

/**
 * A MIDI controller profile (hand-written or imported) as a device. `verified` is true only when every control of the
 * profile is verified on a unit (validateProfile already refuses a `verified: true` that no hardware check backs): a profile
 * with a hardware log that left some controls unchecked is not a verified device.
 */
export function fromMidiProfile(p, { file } = {}) {
  const generic = p.kind === 'generic';
  const name = generic && p.nameEn ? p.nameEn : p.name;
  const controls = Array.isArray(p.controls) ? p.controls : [];
  return {
    format: DEVICE_FORMAT, id: p.id, kind: 'midi-controller', manufacturer: p.maker || null, name,
    aliases: uniq([p.short, p.name]).filter((a) => a !== name),
    connections: [], protocols: ['midi'],
    data: { ref: { type: 'midi-profile', id: p.id, file } },
    setup: [], problems: [],
    use: [{
      package: '@openav/midi', entry: 'MidiControllers',
      call: `new MidiControllers({ profiles: [(await device('${p.id}')).profile], signals, midi })`,
      en: `Plugged in, the port is recognised by its name and every control publishes midi/${p.short}/<control>, 0..1; the same controller is on screen without the hardware.`,
      zh: `插上之後依連接埠名稱認出它，每個控制項送出 midi/${p.short}/<控制項>，0..1。沒有硬體時，螢幕上有同一台控制器。`,
    }],
    sources: (p.sources || []).map((s) => pick(s, SOURCE_KEYS)),
    license: p.license || 'MIT',
    verified: controls.length > 0 && controls.every((c) => c && c.verified === true),
    verifications: (p.verifications || []).map((v) => pick(v, SITTING_KEYS)),
  };
}

/** A DMX fixture profile (open-audiovisual/fixture@1) as a device. */
export function fromFixture(fx, { file } = {}) {
  const name = fx.name.toLowerCase().startsWith(String(fx.manufacturer).toLowerCase()) ? fx.name : `${fx.manufacturer} ${fx.name}`;
  return {
    format: DEVICE_FORMAT, id: fx.id, kind: 'dmx-fixture', manufacturer: fx.manufacturer || null, name,
    aliases: uniq([fx.name, fx.kind, ...(fx.modes || []).map((m) => m.name || m.id)]).filter((a) => a !== name),
    connections: [], protocols: ['dmx512'],
    data: { ref: { type: 'dmx-fixture', id: fx.id, file } },
    setup: [], problems: [],
    use: [{
      package: '@openav/devices', entry: 'device',
      // device().patch() hands the profile to the Patch itself, so it also works for a fixture the Patch has never heard of (an imported one)
      call: `(await device('${fx.id}')).patch(patch, { id: 'light1', mode: '${(fx.modes || [])[0]?.id}', address: 1 })`,
      en: 'Patched at a start address, the light takes dimmer, colour and the rest as 0..1 from the engine, and the transport sends its bytes.',
      zh: 'patch 到一個起始位址之後，這台燈從引擎拿 dimmer、顏色等 0..1 的值，由傳輸送出它的位元組。',
    }],
    sources: (fx.sources || []).map((s) => pick(s, SOURCE_KEYS)),
    license: fx.license || 'MIT',
    verified: fx.verified === true,
    verifications: (fx.verifications || []).map((v) => pick(v, SITTING_KEYS)),
  };
}

/** A part of the @openav/hw library (packages/hw/parts.js, keyed by id) as a device. The library names no maker: null. */
export function fromPart(id, part, { file = 'hw/parts.js' } = {}) {
  const pins = Object.values(part.pins || {});
  return {
    format: DEVICE_FORMAT, id, kind: 'part', manufacturer: null, name: part.name,
    aliases: uniq([part.zh, part.kind]).filter((a) => a !== part.name),
    connections: [],
    protocols: [part.i2c ? 'i2c' : null, pins.some((p) => /^spi-/.test(p && p.kind)) ? 'spi' : null].filter(Boolean),
    data: { ref: { type: 'hw-part', id, file } },
    setup: [], problems: [],
    use: [{
      package: '@openav/hw', entry: 'Hw',
      call: `Hw.check({ board, parts: { x: { part: '${id}' } }, wires })`,
      en: 'Listed in a spec\'s parts, it is checked with the rest of the wiring: voltages, pins, current.',
      zh: '列在規格的零件裡，就跟其他接線一起檢查：電壓、腳位、電流。',
    }],
    sources: (part.sources || []).map((s) => pick(s, SOURCE_KEYS)),
    license: 'MIT',
    verified: false,
    verifications: [],
  };
}
