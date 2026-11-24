// @openav/dmx · fixture — a fixture profile ("open-audiovisual/fixture@1") read and checked.
// A profile says which channels a light has and in what order each mode sends them. The checks are strict because a profile
// that is one channel off moves the wrong motor or opens the wrong shutter: better a red error at patch time than at the show.

export const FORMAT = 'open-audiovisual/fixture@1';
export const CHANNEL_TYPES = ['intensity', 'color', 'pan', 'tilt', 'strobe', 'zoom', 'focus', 'gobo', 'colorWheel', 'speed', 'control', 'generic'];
export const COLORS = ['red', 'green', 'blue', 'white', 'warmWhite', 'coldWhite', 'amber', 'uv', 'cyan', 'magenta', 'yellow', 'lime', 'indigo'];
export const KINDS = ['dimmer', 'par', 'bar', 'strobe', 'moving-head', 'scanner', 'effect', 'other'];
const ID = /^[a-z0-9][a-z0-9_-]*$/;
const KEY = /^[A-Za-z][A-Za-z0-9_]*$/;
const isByte = (v) => Number.isInteger(v) && v >= 0 && v <= 255;
const isObj = (v) => v && typeof v === 'object' && !Array.isArray(v);

/**
 * Everything wrong with a fixture profile, one sentence each; an empty list means it can be patched.
 * @param {object} profile  a parsed open-audiovisual/fixture@1 JSON
 * @returns {string[]}
 */
export function validateFixture(profile) {
  const P = [];
  if (!isObj(profile)) return ['a fixture profile is an object'];
  const at = profile.id ? `${profile.id}: ` : '';
  const bad = (m) => P.push(at + m);
  if (profile.format !== FORMAT) bad(`format must be "${FORMAT}" (got ${JSON.stringify(profile.format)})`);
  if (typeof profile.id !== 'string' || !ID.test(profile.id)) bad('id: lowercase letters, digits, - and _');
  for (const k of ['manufacturer', 'name']) if (typeof profile[k] !== 'string' || !profile[k].trim()) bad(`${k} is a non-empty string`);
  if (!KINDS.includes(profile.kind)) bad(`kind is one of ${KINDS.join(', ')}`);

  const ch = profile.channels;
  if (!isObj(ch) || !Object.keys(ch).length) bad('channels: an object with at least one channel');
  const channels = isObj(ch) ? ch : {};
  for (const [key, c] of Object.entries(channels)) {
    const w = `channel "${key}"`;
    if (!KEY.test(key)) { bad(`${w}: a key starts with a letter and has only letters, digits and _`); continue; }
    if (!isObj(c)) { bad(`${w}: an object`); continue; }
    if (c.fineOf !== undefined) {
      // the low byte of a 16-bit pair: everything else (type, ranges) belongs to the coarse channel
      const coarse = channels[c.fineOf];
      if (!isObj(coarse)) bad(`${w}: fineOf "${c.fineOf}" is not a channel`);
      else if (coarse.fineOf !== undefined) bad(`${w}: fineOf "${c.fineOf}" is itself a fine channel (16-bit pairs only)`);
      for (const k of Object.keys(c)) if (!['fineOf', 'name', 'default'].includes(k)) bad(`${w}: a fine channel has only fineOf, name and default (found ${k})`);
      if (c.default !== undefined && !isByte(c.default)) bad(`${w}: default is 0–255`);
      continue;
    }
    if (!CHANNEL_TYPES.includes(c.type)) { bad(`${w}: type is one of ${CHANNEL_TYPES.join(', ')}`); continue; }
    if (c.type === 'color' && !COLORS.includes(c.color)) bad(`${w}: color is one of ${COLORS.join(', ')}`);
    if (c.type !== 'color' && c.color !== undefined) bad(`${w}: only a color channel has "color"`);
    if (c.default !== undefined && !isByte(c.default)) bad(`${w}: default is 0–255`);
    if (c.degrees !== undefined && !(typeof c.degrees === 'number' && c.degrees > 0)) bad(`${w}: degrees is a positive number`);
    if (c.ranges !== undefined) {
      if (!Array.isArray(c.ranges)) { bad(`${w}: ranges is an array`); continue; }
      let last = -1;
      c.ranges.forEach((r, i) => {
        const rw = `${w} ranges[${i}]`;
        if (!isObj(r) || !isByte(r.from) || !isByte(r.to) || r.from > r.to) { bad(`${rw}: { from, to } with 0 ≤ from ≤ to ≤ 255`); return; }
        if (r.from <= last) bad(`${rw}: ranges go up and do not overlap (${r.from} after ${last})`);
        last = r.to;
        if (typeof r.is !== 'string' || !r.is) bad(`${rw}: "is" says what the range does (open, strobe, …)`);
        if (r.hz !== undefined && !(Array.isArray(r.hz) && r.hz.length === 2 && r.hz.every((x) => typeof x === 'number' && x >= 0) && r.hz[0] <= r.hz[1])) bad(`${rw}: hz is [slowest, fastest] in Hz`);
        if (r.hz !== undefined && r.is !== 'strobe') bad(`${rw}: only a strobe range has hz`);
      });
    }
  }

  if (!Array.isArray(profile.modes) || !profile.modes.length) bad('modes: at least one mode');
  const modeIds = new Set();
  for (const [i, m] of (Array.isArray(profile.modes) ? profile.modes : []).entries()) {
    const w = `modes[${i}]`;
    if (!isObj(m)) { bad(`${w}: an object`); continue; }
    if (typeof m.id !== 'string' || !ID.test(m.id)) bad(`${w}: id: lowercase letters, digits, - and _`);
    else if (modeIds.has(m.id)) bad(`${w}: mode id "${m.id}" is used twice`);
    modeIds.add(m.id);
    if (!Array.isArray(m.channels) || !m.channels.length) { bad(`${w} (${m.id}): channels lists at least one channel`); continue; }
    if (m.channels.length > 512) bad(`${w} (${m.id}): ${m.channels.length} channels do not fit in one universe`);
    const seen = new Set();
    for (const key of m.channels) {
      if (!Object.hasOwn(channels, key)) bad(`${w} (${m.id}): "${key}" is not in channels`);
      if (seen.has(key)) bad(`${w} (${m.id}): "${key}" appears twice`);
      seen.add(key);
    }
    for (const key of m.channels) {
      const c = channels[key];
      if (isObj(c) && c.fineOf !== undefined && !seen.has(c.fineOf)) bad(`${w} (${m.id}): "${key}" is the fine byte of "${c.fineOf}", which this mode does not have`);
    }
  }

  if (profile.license !== undefined && typeof profile.license !== 'string') bad('license is an SPDX id such as "MIT"');
  if (profile.sources !== undefined && !(Array.isArray(profile.sources) && profile.sources.every((s) => isObj(s) && typeof s.title === 'string' && s.title))) bad('sources: [{ title, url?, note?, license? }]');
  if (profile.verified !== undefined && typeof profile.verified !== 'boolean') bad('verified is true or false');
  const verifications = profile.verifications === undefined ? [] : profile.verifications;
  if (!Array.isArray(verifications)) bad('verifications is an array');
  else verifications.forEach((v, i) => {
    if (!isObj(v) || !/^\d{4}-\d{2}-\d{2}$/.test(v.date || '') || typeof v.by !== 'string' || !v.by || !['hardware', 'virtual', 'simulated'].includes(v.method)) bad(`verifications[${i}]: { date: "YYYY-MM-DD", by, method: hardware | virtual | simulated }`);
  });
  // the same rule as the controller profiles: only a person with the light in front of them can say it is right
  if (profile.verified === true && !(Array.isArray(verifications) && verifications.some((v) => isObj(v) && v.method === 'hardware'))) bad('"verified": true needs a verification with method "hardware" (made by a person with the fixture)');
  return P;
}

/**
 * A profile checked and laid out for patching: each mode gets its footprint and, per slot, the channel it carries.
 * Throws an Error listing every problem when the profile is not valid. A profile that is already loaded comes back as is.
 * @param {object} profile  a parsed open-audiovisual/fixture@1 JSON
 */
export function loadFixture(profile) {
  if (isLoaded(profile)) return profile;
  const problems = validateFixture(profile);
  if (problems.length) { const e = new Error(`fixture profile is not valid:\n  ${problems.join('\n  ')}`); e.problems = problems; throw e; }
  const channels = profile.channels;
  const modes = profile.modes.map((m) => {
    const slots = m.channels.map((key, offset) => {
      const c = channels[key];
      const fine = c.fineOf !== undefined;
      const def = fine ? channels[c.fineOf] : c;
      return { key, offset, fine, coarse: fine ? c.fineOf : null, type: def.type, color: def.color || null, default: c.default ?? 0, ranges: fine ? null : def.ranges || null, fineOffset: -1 };
    });
    const byKey = new Map(slots.map((s) => [s.key, s]));
    for (const s of slots) if (s.fine) byKey.get(s.coarse).fineOffset = s.offset;
    return Object.freeze({ id: m.id, name: m.name || m.id, footprint: slots.length, slots: Object.freeze(slots) });
  });
  return Object.freeze({
    format: FORMAT, id: profile.id, manufacturer: profile.manufacturer, name: profile.name, kind: profile.kind,
    license: profile.license || 'MIT', verified: profile.verified === true, modes: Object.freeze(modes), profile,
  });
}

/** A loaded fixture (what loadFixture returns): its modes carry slots. Duck-typed on purpose (a stamped and an unstamped import are two modules). */
export function isLoaded(f) {
  return isObj(f) && f.format === FORMAT && Array.isArray(f.modes) && f.modes.length > 0 && Array.isArray(f.modes[0].slots) && isObj(f.profile);
}
