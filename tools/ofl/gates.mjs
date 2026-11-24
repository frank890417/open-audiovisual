// What a converted OFL fixture must pass before it is imported (tools/import-ofl.mjs refuses a file that fails one).
// Pure: the OFL JSON and the converted profile in, one sentence per problem out ([] = import it).
//
// The converter (import.mjs) already refuses what it cannot read (matrix, template and switching channels). These gates catch
// what it can read but the engine would get wrong on a real light, so the channel table on the site and the bytes a show sends
// stay true to the fixture:
//   • inverted     an OFL intensity that goes from bright to dark: the engine writes 0..1 upwards, the light would be upside down.
//   • key          a channel whose key is one of the Patch's properties (dimmer, color, pan, tilt, strobe, zoom) but is not the
//                  slot that property drives (a UV channel OFL calls "Dimmer"): a show asking for that property cannot reach it.
//   • dark         a mode in which { dimmer: 1, color: [1, 1, 1] } leaves every intensity and colour byte at 0 (only a preset or
//                  a program channel makes light).
//   • closed       a mode with intensity or colour whose strobe or shutter channel rests (its default) outside an open range:
//                  the light would stay dark while the page showed it lit. A strobe range at 0 Hz is steady light and counts as
//                  open. A mode that is a strobe channel and nothing else is dark at rest by design and is not held to this.
//   • manual       the OFL file links no manual: nothing to check the table against.

import { Patch, PROPS } from '../../packages/dmx/patch.js';

const pct = (s) => {
  if (s === 'off' || s === 'dark') return 0;
  if (s === 'bright') return 100;
  const m = /^(-?\d+(?:\.\d+)?)%$/.exec(String(s ?? ''));
  return m ? Number(m[1]) : null;
};

/** Problems read off the OFL file itself. */
export function oflProblems(ofl) {
  const out = [];
  if (!(ofl.links && ofl.links.manual && ofl.links.manual.length)) out.push('manual: the OFL file links no manual');
  for (const [n, ch] of Object.entries(ofl.availableChannels || {})) {
    for (const c of ch.capabilities || (ch.capability ? [ch.capability] : [])) {
      if (c.type !== 'Intensity' && c.type !== 'ColorIntensity') continue;
      const a = pct(c.brightnessStart ?? c.brightness), b = pct(c.brightnessEnd ?? c.brightness);
      if (a !== null && b !== null && a > b) { out.push(`inverted: "${n}" goes from ${c.brightnessStart} to ${c.brightnessEnd}`); break; }
    }
  }
  return out;
}

/** Problems of the converted profile, mode by mode, found by patching and rendering it. */
export function profileProblems(fx) {
  const out = [];
  const p = new Patch({ profiles: [fx] });
  fx.modes.forEach((mode, i) => {
    const rec = p.add({ id: `gate-${i}`, profile: fx.id, mode: mode.id, address: 1 });
    const L = rec.layout;
    for (const k of mode.channels) {
      if (!PROPS.includes(k)) continue;
      const drives = { dimmer: L.intensity, strobe: L.strobe, pan: L.pan, tilt: L.tilt, zoom: L.zoom, color: null }[k];
      if (!drives || drives.key !== k) out.push(`key: in mode ${mode.id}, "${k}" is a ${fx.channels[k].type || 'fine'} channel, which the ${k} property does not drive`);
    }
    const light = [...L.intensities, ...L.colors];
    const bytes = p.render({ [rec.id]: { dimmer: 1, color: [1, 1, 1] } }).bytes(1);
    if (!light.length && !L.strobes.length) out.push(`dark: mode ${mode.id} has no intensity, colour or strobe channel`);
    else if (light.length && light.every((s) => bytes[s.offset] === 0)) out.push(`dark: in mode ${mode.id}, full white leaves every intensity and colour byte at 0`);
    if (light.length) {
      for (const s of L.strobes) {
        const b = bytes[s.offset], rs = s.ranges || [];
        const open = rs.some((r) => r.is === 'open' && b >= r.from && b <= r.to);
        const steady = rs.some((r) => r.is === 'strobe' && r.hz && r.hz[0] === 0 && b === r.from);
        if (!open && !steady) out.push(`closed: in mode ${mode.id}, "${s.key}" rests at ${b}, which is not an open value`);
      }
    }
    p.remove(rec.id);
  });
  return [...new Set(out)];
}

/** Every reason not to import this fixture ([] = import it). */
export const importProblems = (ofl, fx) => [...oflProblems(ofl), ...profileProblems(fx)];
