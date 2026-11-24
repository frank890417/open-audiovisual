// @openav/dmx · patch — which light sits on which universe and address, and how "dimmer 0.8, colour orange" becomes its bytes.
// A work names lights and asks for properties (dimmer, color, pan, tilt, strobe, zoom, 0..1); the patch knows that on this
// RGBW par the red is the third channel and that this moving head wants pan as two bytes. Nobody writing a work should have
// to remember that channel 37 is red.

import { loadFixture, isLoaded } from './fixture.js?v=6b091ec6';
import { rgbToChannels } from './color.js?v=6b091ec6';
import { Universes, SLOTS } from './universe.js?v=6b091ec6';
import { FIXTURES } from './fixtures/index.js?v=6b091ec6';

export const PATCH_FORMAT = 'open-audiovisual/patch@1';
/** The properties every fixture understands (each 0..1; color is [r, g, b]). Any other name is a channel key of the profile. */
export const PROPS = ['dimmer', 'color', 'pan', 'tilt', 'strobe', 'zoom'];
const ID = /^[a-z0-9][a-z0-9_-]*$/;
const clamp01 = (v) => (v > 1 ? 1 : v > 0 ? v : 0);
const isObj = (v) => v && typeof v === 'object' && !Array.isArray(v);

/**
 * Where each property goes in one mode: the slots, found once per placed fixture. `dimmer` drives every intensity channel and
 * `strobe` the first strobe channel; a second one of either is reached by its key, and still gets the master, blackout and the cap.
 */
export function layoutOf(mode) {
  const all = (type) => mode.slots.filter((s) => !s.fine && s.type === type);
  const first = (type) => all(type)[0] || null;
  const L = {
    intensities: all('intensity'), strobes: all('strobe'), colors: all('color'),
    intensity: first('intensity'), pan: first('pan'), tilt: first('tilt'), strobe: first('strobe'), zoom: first('zoom'),
    byKey: new Map(mode.slots.filter((s) => !s.fine).map((s) => [s.key, s])),
  };
  L.claimed = new Set([L.intensity, L.pan, L.tilt, L.strobe, L.zoom, ...L.colors].filter(Boolean).map((s) => s.key));
  return L;
}

/** The flash cap must be a number above 0; only Infinity switches it off (NaN or a missing value must not do that quietly). */
export function checkCap(maxFlashHz) {
  if (!(typeof maxFlashHz === 'number' && maxFlashHz > 0)) throw new RangeError(`maxFlashHz is a number above 0, Infinity to switch the cap off (got ${maxFlashHz})`);
  return maxFlashHz;
}

const wide = (slot) => slot.fineOffset >= 0;
const default01 = (slot, mode) => (wide(slot) ? (slot.default * 256 + mode.slots[slot.fineOffset].default) / 65535 : slot.default / 255);

/** What a property is when no layer sets it, for one placed fixture (undefined when the fixture has no such thing). */
export function defaultOf(rec, prop) {
  const L = rec.layout;
  if (prop === 'dimmer') return L.intensity ? default01(L.intensity, rec.mode) : 1;   // no dimmer channel: the colour alone decides
  if (prop === 'color') return L.colors.length ? [0, 0, 0] : undefined;
  if (prop === 'strobe') return L.strobe ? 0 : undefined;
  if (prop === 'pan' || prop === 'tilt' || prop === 'zoom') return L[prop] ? default01(L[prop], rec.mode) : undefined;
  const s = L.byKey.get(prop);
  if (!s || s.type === 'control') return undefined;
  return s.type === 'strobe' ? 0 : default01(s, rec.mode);
}

/** The highest strobe value (0..1) that stays at or under maxFlashHz on this channel; 0 when the channel does not say its Hz. */
function strobeCeiling(slot, maxFlashHz) {
  if (checkCap(maxFlashHz) === Infinity) return 1;
  const s = (slot.ranges || []).find((r) => r.is === 'strobe');
  if (!s || !s.hz) return 0;                       // how fast this value flashes is unknown, so it is not used under the cap
  const [h0, h1] = s.hz;
  if (h1 <= maxFlashHz) return 1;
  if (h0 > maxFlashHz) return 0;
  return (maxFlashHz - h0) / (h1 - h0);
}

/** The byte for a strobe value 0..1: 0 is the open (steady) value; above 0 walks the strobe range (Hz read as linear across it). */
function strobeByte(slot, p) {
  const ranges = slot.ranges || [];
  const open = ranges.find((r) => r.is === 'open');
  const openByte = open ? open.from : slot.default;
  if (!(p > 0)) return openByte;
  const s = ranges.length ? ranges.find((r) => r.is === 'strobe') : { from: 0, to: 255 };
  if (!s) return openByte;
  return Math.floor(s.from + clamp01(p) * (s.to - s.from));   // floor: never a step faster than asked
}

function checkLimits(limits, id) {
  if (!isObj(limits)) throw new TypeError(`${id}: limits is an object such as { dimmer: [0, 0.8] }`);
  for (const [k, v] of Object.entries(limits)) {
    if (!(Array.isArray(v) && v.length === 2 && v.every((x) => typeof x === 'number' && x >= 0 && x <= 1) && v[0] <= v[1])) throw new RangeError(`${id}: limits.${k} is [min, max] within 0..1`);
  }
}

/** Fixtures placed on universes and addresses, with groups, per-fixture limits, and properties turned into bytes. */
export class Patch {
  #list = [];
  #byId = new Map();
  #profiles = new Map();

  constructor({ profiles = [] } = {}) {
    for (const p of profiles) this.#remember(loadFixture(p));
  }

  #remember(fx) {
    if (!this.#profiles.has(fx.id)) this.#profiles.set(fx.id, fx);
    return fx;
  }

  #profileOf(ref) {
    if (typeof ref === 'string') {
      const known = this.#profiles.get(ref) || FIXTURES.find((f) => f.id === ref);
      if (!known) throw new Error(`no fixture profile "${ref}" (shipped: ${FIXTURES.map((f) => f.id).join(', ')})`);
      return this.#remember(loadFixture(known));
    }
    if (isObj(ref)) return this.#remember(isLoaded(ref) ? ref : loadFixture(ref));
    throw new TypeError('profile is a fixture profile or the id of one');
  }

  /**
   * Place a fixture. Throws for an unknown profile or mode, an address that is not 1..512, a footprint that runs past 512,
   * an id used twice and a group named like a fixture. Two fixtures on the same addresses are allowed (doubling two
   * identical pars is common): check() lists them.
   */
  add({ id, profile, mode, universe = 1, address, name, groups = [], limits = {} } = {}) {
    if (typeof id !== 'string' || !ID.test(id)) throw new TypeError(`fixture id: lowercase letters, digits, - and _ (got ${JSON.stringify(id)})`);
    if (this.#byId.has(id)) throw new Error(`fixture "${id}" is already patched`);
    if (this.#list.some((r) => r.groups.includes(id))) throw new Error(`"${id}" is already a group name`);
    const fx = this.#profileOf(profile);
    const m = mode === undefined ? fx.modes[0] : fx.modes.find((x) => x.id === mode);
    if (!m) throw new Error(`${id}: ${fx.id} has no mode "${mode}" (modes: ${fx.modes.map((x) => x.id).join(', ')})`);
    if (!Number.isInteger(universe) || universe < 0 || universe > 63999) throw new RangeError(`${id}: universe is an integer 0–63999`);
    if (!Number.isInteger(address) || address < 1 || address > SLOTS) throw new RangeError(`${id}: address is an integer 1–512 (got ${address})`);
    if (address + m.footprint - 1 > SLOTS) throw new RangeError(`${id}: ${fx.id} ${m.id} takes ${m.footprint} channels, so from address ${address} it runs past 512 (last start address: ${SLOTS - m.footprint + 1})`);
    if (!Array.isArray(groups) || !groups.every((g) => typeof g === 'string' && ID.test(g))) throw new TypeError(`${id}: groups is a list of names (lowercase letters, digits, - and _)`);
    for (const g of groups) if (this.#byId.has(g) || g === id) throw new Error(`${id}: group "${g}" has the name of a fixture`);
    checkLimits(limits, id);
    const rec = Object.freeze({
      id, name: name || id, profile: fx, mode: m, universe, address, footprint: m.footprint,
      groups: Object.freeze([...groups]), limits: Object.freeze({ ...limits }), layout: layoutOf(m),
    });
    this.#list.push(rec);
    this.#byId.set(id, rec);
    return rec;
  }

  /** Take a fixture out of the patch; true when it was there. */
  remove(id) {
    const rec = this.#byId.get(id);
    if (!rec) return false;
    this.#byId.delete(id);
    this.#list.splice(this.#list.indexOf(rec), 1);
    return true;
  }

  /** The placed fixture with this id, or null. */
  get(id) {
    return this.#byId.get(id) || null;
  }

  /** Every placed fixture, in the order they were added. */
  get fixtures() {
    return [...this.#list];
  }

  /** Fixture ids for a target: a fixture id, a group name, '*' for all, or a list of these. Unknown names give nothing. */
  ids(target) {
    if (Array.isArray(target)) return [...new Set(target.flatMap((t) => this.ids(t)))];
    if (target === '*') return this.#list.map((r) => r.id);
    if (this.#byId.has(target)) return [target];
    return this.#list.filter((r) => r.groups.includes(target)).map((r) => r.id);
  }

  /** What to look at before a show: fixtures that share addresses ({ code: 'overlap', universe, address, ids, text }). */
  check() {
    const problems = [];
    const byU = new Map();
    for (const r of this.#list) (byU.get(r.universe) || byU.set(r.universe, []).get(r.universe)).push(r);
    for (const [u, list] of byU) {
      for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) {
        const a = list[i], b = list[j];
        const from = Math.max(a.address, b.address), to = Math.min(a.address + a.footprint, b.address + b.footprint) - 1;
        if (from <= to) problems.push({ code: 'overlap', universe: u, address: [from, to], ids: [a.id, b.id], text: `${a.id} and ${b.id} share universe ${u}, addresses ${from}–${to}` });
      }
    }
    return problems;
  }

  /** The patch as data: { format, fixtures: [{ id, profile, mode, universe, address, name, groups, limits }] }. */
  toJSON() {
    return {
      format: PATCH_FORMAT,
      fixtures: this.#list.map((r) => ({
        id: r.id, profile: r.profile.id, mode: r.mode.id, universe: r.universe, address: r.address,
        ...(r.name !== r.id ? { name: r.name } : {}), ...(r.groups.length ? { groups: [...r.groups] } : {}), ...(Object.keys(r.limits).length ? { limits: { ...r.limits } } : {}),
      })),
    };
  }

  /** A patch from toJSON() data. Profiles are looked up by id among `profiles`, then the shipped generic ones. */
  static fromJSON(json, { profiles = [] } = {}) {
    if (!isObj(json) || json.format !== PATCH_FORMAT || !Array.isArray(json.fixtures)) throw new Error(`a patch is { format: "${PATCH_FORMAT}", fixtures: [...] }`);
    const p = new Patch({ profiles });
    for (const f of json.fixtures) p.add(f);
    return p;
  }

  /**
   * The properties a fixture will really get, after its limits, the master, blackout and the flash cap on its strobe.
   * @param {string} id
   * @param {object} props  { dimmer, color: [r, g, b], pan, tilt, strobe, zoom, <channel key>: 0..1 }
   */
  resolve(id, props = {}, { master = 1, blackout = false, maxFlashHz = 3 } = {}) {
    const rec = this.#byId.get(id);
    if (!rec) throw new Error(`no fixture "${id}" in the patch`);
    const L = rec.layout, lim = rec.limits;
    const limit = (k, v) => (lim[k] ? Math.min(lim[k][1], Math.max(lim[k][0], v)) : v);
    const out = {};
    let dimmer = props.dimmer === undefined ? defaultOf(rec, 'dimmer') : clamp01(props.dimmer);
    dimmer = limit('dimmer', dimmer) * clamp01(master);
    out.dimmer = blackout ? 0 : dimmer;
    if (props.color !== undefined && L.colors.length) out.color = [0, 1, 2].map((i) => clamp01(Number(props.color[i]) || 0));
    for (const k of ['pan', 'tilt', 'zoom']) if (props[k] !== undefined && L[k]) out[k] = limit(k, clamp01(props[k]));
    checkCap(maxFlashHz);
    // every strobe channel is held to the cap and opened by blackout: the first answers to `strobe`, any other to its key
    for (const s of L.strobes) {
      const k = s === L.strobe ? 'strobe' : s.key;
      if (props[k] === undefined && !blackout) continue;
      out[k] = blackout ? 0 : Math.min(limit(k, clamp01(props[k])), strobeCeiling(s, maxFlashHz));
    }
    for (const [k, v] of Object.entries(props)) {
      if (PROPS.includes(k)) continue;
      const s = L.byKey.get(k);
      if (!s || s.type === 'control' || s.type === 'strobe' || (L.claimed.has(k) && s.type !== 'color')) continue;
      // a second intensity channel by its key: the dimmer's limits, the master and blackout still apply
      out[k] = s.type === 'intensity' ? (blackout ? 0 : limit(k, limit('dimmer', clamp01(v))) * clamp01(master)) : limit(k, clamp01(v));
    }
    return out;
  }

  /**
   * Every patched fixture's bytes for one moment: `states` maps fixture id → properties (see resolve). A fixture with no state
   * gets its channel defaults. `controls` maps fixture id → { control channel key: byte }, the only way a control channel
   * (reset, lamp on/off) is written. Returns the universes (pass `universes` to write into ones you have).
   */
  render(states = {}, { master = 1, blackout = false, maxFlashHz = 3, controls = {}, universes } = {}) {
    const U = universes || new Universes();
    for (const rec of this.#list) {
      const { mode } = rec, L = rec.layout;
      const bytes = mode.slots.map((s) => s.default);
      const put = (slot, v) => {
        if (wide(slot)) { const x = Math.round(clamp01(v) * 65535); bytes[slot.offset] = x >> 8; bytes[slot.fineOffset] = x & 255; }
        else bytes[slot.offset] = Math.round(clamp01(v) * 255);
      };
      const props = this.resolve(rec.id, states[rec.id] || {}, { master, blackout, maxFlashHz });
      for (const s of L.intensities) put(s, s !== L.intensity && props[s.key] !== undefined ? props[s.key] : props.dimmer);
      if (L.colors.length) {
        const split = props.color ? rgbToChannels(props.color, L.colors.map((s) => s.color)) : null;
        for (const s of L.colors) {
          let v = props[s.key] !== undefined ? props[s.key] : split ? split[s.color] : default01(s, mode);
          if (!L.intensity) v *= props.dimmer;             // no dimmer channel: the dimmer (and the master, and blackout) is in the colour
          put(s, v);
        }
      }
      for (const k of ['pan', 'tilt', 'zoom']) if (props[k] !== undefined) put(L[k], props[k]);
      for (const s of L.strobes) {
        const v = props[s === L.strobe ? 'strobe' : s.key];
        if (v === undefined) continue;
        bytes[s.offset] = strobeByte(s, v);
        if (wide(s)) bytes[s.fineOffset] = 0;
      }
      for (const [k, v] of Object.entries(props)) {
        if (PROPS.includes(k) || L.claimed.has(k)) continue;
        const s = L.byKey.get(k);
        if (s.type === 'intensity' || s.type === 'strobe') continue;   // written above, through the safety layers
        put(s, v);
      }
      for (const [k, v] of Object.entries(controls[rec.id] || {})) {
        const s = L.byKey.get(k);
        if (!s || s.type !== 'control') throw new Error(`${rec.id}: "${k}" is not a control channel of ${rec.profile.id} ${mode.id}`);
        if (!Number.isInteger(v) || v < 0 || v > 255) throw new RangeError(`${rec.id}: control ${k} is a byte 0–255`);
        bytes[s.offset] = v;
      }
      U.get(rec.universe).write(rec.address, bytes);
    }
    return U;
  }
}
