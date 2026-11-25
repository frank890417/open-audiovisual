// @openav/devices — one collection of the show devices OAV knows: MIDI controllers, DMX fixtures, the parts of the
// electronics library, and the cameras, audio interfaces, sensors, LED and DMX interfaces people bring. One outer record
// for all of them (open-audiovisual/device@1, device.schema.json), one way in.
//
//   devices({ kind: 'midi-controller', q: 'minilab' })   → the rows that match, from catalog.js (no profile is loaded)
//   const mini = await device('arturia-minilab3')         → mini.profile, mini.routes({ knob1: 'hue' }), mini.addTo(controllers)
//   const par  = await device('generic-rgbw')             → par.patch(patch, { address: 1 })
//   const cam  = await device('logitech-mx-brio')         → cam.find(), cam.open(): the camera, asked for only when you call
//
// The collection copies nothing: a MIDI profile, a DMX fixture and a part stay in their own files, and their records are
// read off those files (derive.js), at build time for the list (tools/build-devices.mjs writes catalog.js) and again by
// device() for the one it loads. Hand-written records (records/<id>.json) are for devices with no deeper format.
// Listing never loads a profile: device() imports the one file it needs.

import { KINDS, CONNECTIONS } from './record.js?v=cedb93fa';
import { fromMidiProfile, fromFixture, fromPart } from './derive.js?v=cedb93fa';
import { CATALOG } from './catalog.js?v=cedb93fa';

const freeze = (o) => { for (const v of Object.values(o)) if (v && typeof v === 'object') freeze(v); return Object.freeze(o); };
const ROWS = freeze(CATALOG.map((r) => ({ ...r })));

/** What a device can be, in the order the collection lists them. */
export const deviceKinds = KINDS;

const fold = (s) => String(s).toLowerCase();
const squash = (s) => fold(s).replace(/[^a-z0-9㐀-鿿]+/g, '');
const words = (r) => [r.id, r.name, r.manufacturer || '', ...r.aliases];

/** How well a row answers a query: 0 = a name is the query, 1 = a name starts with it, 2 = every word is somewhere. */
function rank(r, q) {
  const names = words(r).map(squash), s = squash(q);
  if (names.includes(s)) return 0;
  if (names.some((n) => n.startsWith(s))) return 1;
  return 2;
}

/**
 * The devices in the collection, or the ones that match. Each row is { id, kind, manufacturer, name, aliases, connections,
 * protocols, verified, from, file }, frozen; `from` says where the record is read from, `file` is that file inside packages/.
 * `q` matches every word against the name, the aliases, the manufacturer and the id, ignoring case, spaces and punctuation.
 */
export function devices({ kind, q, connection } = {}) {
  const kinds = kind === undefined ? null : [].concat(kind);
  if (kinds) for (const k of kinds) if (!KINDS.includes(k)) throw new RangeError(`devices({ kind }): one of ${KINDS.join(', ')} (got ${JSON.stringify(k)})`);
  if (connection !== undefined && !CONNECTIONS.includes(connection)) throw new RangeError(`devices({ connection }): one of ${CONNECTIONS.join(', ')} (got ${JSON.stringify(connection)})`);
  const tokens = q === undefined || q === null ? [] : fold(q).split(/\s+/).filter(Boolean);
  let out = ROWS.filter((r) => (!kinds || kinds.includes(r.kind)) && (connection === undefined || r.connections.includes(connection)));
  if (tokens.length) {
    out = out.filter((r) => {
      const hay = fold(words(r).join(' ')), flat = squash(hay);
      return tokens.every((t) => hay.includes(t) || (squash(t) !== '' && flat.includes(squash(t))));
    });
    const scored = out.map((r, i) => ({ r, i, s: rank(r, q) }));
    scored.sort((a, b) => a.s - b.s || a.i - b.i);
    out = scored.map((x) => x.r);
  }
  return out;
}

// --------------------------------------------------------------------------- loading one device
/** A JSON file inside packages/, by its path there. One file, imported when it is asked for. */
async function loadJson(file) {
  const url = new URL(`../${file}`, import.meta.url).href;
  return (await import(url, { with: { type: 'json' } })).default;
}

const base = (record) => ({ id: record.id, kind: record.kind, name: record.name, record });

/**
 * One device, ready for OAV: a handle that depends on its kind. Always { id, kind, name, record } (record = its
 * open-audiovisual/device@1 record). Then:
 *   midi-controller   profile, routes(bindings, options) → mapper routes, addTo(controllers) → the MidiController
 *   dmx-fixture       profile, patch(patch, { id, universe, address, mode, groups, name, limits }) → the placed fixture
 *   part              part (the @openav/hw library entry)
 *   camera, audio-interface   constraints(deviceId?), find() → the MediaDeviceInfo or null, open() → a MediaStream
 * Nothing asks for a permission until find() (enumerateDevices) or open() (getUserMedia) is called.
 * `options`: defaults for patch() (id, universe, address, mode) and, for tests, `mediaDevices` in place of navigator's.
 */
export async function device(id, options = {}) {
  const row = ROWS.find((r) => r.id === id);
  if (!row) {
    const near = devices({ q: String(id || '').replace(/[-_]+/g, ' ') }).slice(0, 3).map((r) => r.id);
    throw new Error(`unknown device "${id}"${near.length ? ` (did you mean ${near.join(', ')}?)` : ''}`);
  }
  if (row.from === 'midi-profile') {
    const [{ resolveProfile }, { controllerRoutes }] = await Promise.all([import('../midi/embed.js?v=cedb93fa'), import('../midi/manager.js?v=cedb93fa')]);
    const profile = await resolveProfile(await loadJson(row.file));   // validated as @openav/midi validates any profile
    const record = fromMidiProfile(profile, { file: row.file });
    return {
      ...base(record), profile,
      /** Mapper routes for "this control drives that param" (controllerRoutes of @openav/midi). */
      routes: (bindings, opts) => controllerRoutes(profile, bindings, opts),
      /** Put this controller into a MidiControllers (yours, or a show's) and get its live MidiController. */
      addTo: (controllers) => { controllers.register(profile); return controllers.get(profile.id); },
    };
  }
  if (row.from === 'dmx-fixture') {
    const profile = await loadJson(row.file);
    const record = fromFixture(profile, { file: row.file });
    return {
      ...base(record), profile,
      /** Place this fixture in a @openav/dmx Patch: patch(p, { address: 1 }). The id defaults to <device>-<universe>-<address>. */
      patch: (p, opts = {}) => {
        const o = { universe: 1, ...pickPatch(options), ...opts };
        const fid = o.id || `${record.id}-${o.universe}-${o.address}`;
        return p.add({ id: fid, profile, mode: o.mode, universe: o.universe, address: o.address, name: o.name, groups: o.groups, limits: o.limits });
      },
    };
  }
  if (row.from === 'hw-part') {
    const { PARTS } = await import('../hw/parts.js?v=cedb93fa');
    const part = PARTS[id];
    return { ...base(fromPart(id, part, { file: row.file })), part };
  }
  const record = await loadJson(row.file);
  if (record.kind === 'camera' || record.kind === 'audio-interface') return mediaHandle(record, options);
  return base(record);
}

const pickPatch = (o) => Object.fromEntries(['id', 'universe', 'address', 'mode', 'groups', 'name', 'limits'].filter((k) => o[k] !== undefined).map((k) => [k, o[k]]));

/** A camera or an audio input, found by its label. enumerateDevices() only in find(), getUserMedia() only in open(). */
async function mediaHandle(record, options) {
  const m = record.media;
  const patterns = m.labels.map((s) => new RegExp(s, 'i'));
  const { cameraConstraints } = m.input === 'videoinput' ? await import('../record/camera.js?v=cedb93fa') : {};
  const md = () => {
    const api = options.mediaDevices || (typeof navigator !== 'undefined' ? navigator.mediaDevices : null);
    if (!api) throw new Error(`${record.name}: no navigator.mediaDevices here (it needs a browser page on https or localhost)`);
    return api;
  };
  const list = async () => (await md().enumerateDevices()).filter((d) => d.kind === m.input);
  const constraints = (deviceId = '') => (m.input === 'videoinput'
    ? cameraConstraints({ ...m.constraints, deviceId })
    : { audio: { ...m.constraints, ...(deviceId ? { deviceId: { exact: deviceId } } : {}) }, video: false });
  const find = async () => (await list()).find((d) => patterns.some((re) => re.test(d.label || ''))) || null;
  const missing = (all) => new Error(`${record.name}: no ${m.input === 'videoinput' ? 'camera' : 'audio input'} whose name matches ${m.labels.join(' | ')} (found: ${all.map((d) => d.label || '(no label)').join(', ') || 'none'})`);
  return {
    ...base(record),
    /** getUserMedia constraints with the recommended settings, for this deviceId when given. Pure. */
    constraints,
    /** The matching MediaDeviceInfo, or null. Labels are empty until the page has had the permission once: null then. */
    find,
    /** Ask for the device and open it. The caller owns the stream (stop its tracks when done). */
    open: async () => {
      const hit = await find();
      if (hit) return md().getUserMedia(constraints(hit.deviceId));
      const all = await list();
      if (all.some((d) => d.label)) throw missing(all);              // names are visible and none is this device
      const first = await md().getUserMedia(constraints());          // the permission prompt; then the names are there
      const now = await find();
      const got = first.getTracks()[0]?.getSettings?.().deviceId;
      if (now && got === now.deviceId) return first;
      first.getTracks().forEach((t) => t.stop());
      if (!now) throw missing(await list());
      return md().getUserMedia(constraints(now.deviceId));
    },
  };
}
