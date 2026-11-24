// @openav/devices · record — the outer record every device has (open-audiovisual/device@1), and its check.
//
// A record says what a device is and how OAV reaches it; what it sends or what it is made of lives in the format of its
// kind and stays there: a MIDI profile (packages/midi/profiles), a DMX fixture (packages/dmx/fixtures), a part of the
// electronics library (packages/hw/parts.js). `data.ref` points at that file. A device with no deeper format (a camera, an
// audio interface, a printer) carries its facts inline in `data.facts`, each one citing the page it was read from.
// device.schema.json describes the same record for software that does not run this package; validateDevice() is
// stricter: every citation must point at a source that exists, and `verified: true` needs a hardware check in the log.
// Pure: no imports, no DOM.

export const DEVICE_FORMAT = 'open-audiovisual/device@1';

/** What a device is, in the order the collection lists them. */
export const KINDS = Object.freeze(['midi-controller', 'dmx-fixture', 'dmx-interface', 'led-controller', 'sensor', 'camera',
  'audio-interface', 'projector', 'display', 'printer', 'part']);

/** The ways a device plugs in. */
export const CONNECTIONS = Object.freeze(['usb', 'din-midi', 'trs-midi', 'ethernet', 'wifi', 'bluetooth', 'hdmi', 'displayport',
  'sdi', 'dmx-xlr3', 'dmx-xlr5', 'audio-xlr', 'audio-jack']);

/** The kind-specific formats a record can point at. */
export const REF_TYPES = Object.freeze(['midi-profile', 'dmx-fixture', 'hw-part']);
export const VERIFY_METHODS = Object.freeze(['hardware', 'virtual', 'simulated']);

const KEYS = ['format', 'id', 'kind', 'manufacturer', 'name', 'aliases', 'connections', 'protocols', 'data', 'media', 'setup', 'problems',
  'use', 'sources', 'license', 'verified', 'verifications', 'notes', 'tbd'];
const ID_RE = /^[a-z0-9][a-z0-9_-]*$/;
const PROTOCOL_RE = /^[a-z0-9][a-z0-9.+-]*$/;
const FACT_KEY_RE = /^[a-z][A-Za-z0-9]*$/;
const PACKAGE_RE = /^@openav\/[a-z0-9-]+$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const CJK = /[⺀-⿿぀-ヿ㐀-鿿豈-﫿＀-￯]/;
const text = (v) => typeof v === 'string' && v.trim() !== '';
const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const isIndex = (v, list) => Number.isInteger(v) && v >= 0 && v < list.length;

/** Every problem with a device record, one sentence each ([] = valid). */
export function validateDevice(r) {
  const errs = [];
  if (!isObj(r)) return ['a device record is an object'];
  const at = (where, msg) => errs.push(`${r.id || '?'}: ${where}${msg}`);
  for (const k of Object.keys(r)) if (!KEYS.includes(k)) at('', `unknown field "${k}"`);
  if (r.format !== DEVICE_FORMAT) at('', `format must be "${DEVICE_FORMAT}"`);
  if (!ID_RE.test(r.id || '')) at('', 'id must be lower-case [a-z0-9_-]');
  if (!KINDS.includes(r.kind)) at('', `kind must be one of ${KINDS.join(', ')}`);
  if (!(r.manufacturer === null || text(r.manufacturer))) at('', 'manufacturer is a name, or null when the file names none');
  if (!text(r.name)) at('', 'name is missing');
  if (!Array.isArray(r.aliases) || !r.aliases.every(text)) at('', 'aliases is a list of names');
  if (!Array.isArray(r.connections) || !r.connections.every((c) => CONNECTIONS.includes(c))) at('', `connections are from ${CONNECTIONS.join(', ')}`);
  else if (new Set(r.connections).size !== r.connections.length) at('', 'a connection is listed twice');
  if (!Array.isArray(r.protocols) || !r.protocols.every((p) => PROTOCOL_RE.test(p || ''))) at('', 'protocols are lower-case names (midi, dmx512, art-net…)');
  const sources = Array.isArray(r.sources) ? r.sources : [];
  if (!Array.isArray(r.sources)) at('', 'sources is a list');
  sources.forEach((s, i) => {
    if (!isObj(s) || !text(s.title)) at(`sources[${i}]`, ': needs a title');
    else {
      if (s.url !== undefined && !/^https?:\/\//.test(s.url)) at(`sources[${i}]`, ': url is http(s)');
      if (s.read !== undefined && !DATE_RE.test(s.read)) at(`sources[${i}]`, ': read is YYYY-MM-DD');
    }
  });
  const cites = (v, where) => { if (!isIndex(v, sources)) at(where, ': source must be an index into sources'); };
  // data: a pointer to the kind's own format, facts read from a source, or both
  if (!isObj(r.data) || (r.data.ref === undefined && r.data.facts === undefined)) at('', 'data needs ref, facts or both');
  else {
    for (const k of Object.keys(r.data)) if (!['ref', 'facts'].includes(k)) at('data', `: unknown field "${k}"`);
    const ref = r.data.ref;
    if (ref !== undefined) {
      if (!isObj(ref) || !REF_TYPES.includes(ref.type)) at('data.ref', `: type is one of ${REF_TYPES.join(', ')}`);
      else {
        if (!ID_RE.test(ref.id || '')) at('data.ref', ': id must be lower-case [a-z0-9_-]');
        if (!text(ref.file) || ref.file.startsWith('/') || ref.file.includes('..')) at('data.ref', ': file is a path inside packages/');
      }
    }
    if (r.data.facts !== undefined) {
      if (!Array.isArray(r.data.facts) || !r.data.facts.length) at('data.facts', ' is a non-empty list');
      else r.data.facts.forEach((f, i) => {
        const w = `data.facts[${i}]`;
        if (!isObj(f) || !FACT_KEY_RE.test(f.key || '')) { at(w, ': key is camelCase'); return; }
        if (f.value === undefined || f.value === null || f.value === '') at(w, ` (${f.key}): value is missing`);
        if (f.unit !== undefined && !text(f.unit)) at(w, ` (${f.key}): unit is text`);
        cites(f.source, `${w} (${f.key})`);
      });
    }
  }
  // media: how a browser finds this camera or audio input (camera and audio-interface only)
  const wantsMedia = r.kind === 'camera' || r.kind === 'audio-interface';
  if (wantsMedia && r.media === undefined) at('', 'a camera or an audio interface needs media: { input, labels, constraints, sources }');
  if (r.media !== undefined) {
    const m = r.media;
    if (!wantsMedia) at('media', ': only a camera or an audio interface has it');
    if (!isObj(m)) at('media', ' is an object');
    else {
      const want = r.kind === 'camera' ? 'videoinput' : 'audioinput';
      if (m.input !== want) at('media', `.input is "${want}" for a ${r.kind}`);
      if (!Array.isArray(m.labels) || !m.labels.length) at('media', '.labels lists what to look for in a device label');
      else for (const s of m.labels) { try { new RegExp(s, 'i'); } catch { at('media', `.labels: bad pattern "${s}"`); } }
      if (!isObj(m.constraints)) at('media', '.constraints is an object');
      if (!Array.isArray(m.sources) || !m.sources.length) at('media', '.sources names where the constraints come from');
      else m.sources.forEach((s) => cites(s, 'media.sources'));
    }
  }
  const pairs = (list, where, withSource) => {
    if (!Array.isArray(list)) { at('', `${where} is a list`); return; }
    list.forEach((x, i) => {
      const w = `${where}[${i}]`;
      if (!isObj(x) || !text(x.en) || !text(x.zh)) { at(w, ': needs { en, zh }'); return; }
      if (CJK.test(x.en)) at(w, '.en has Chinese characters');
      if (!CJK.test(x.zh)) at(w, '.zh has no Chinese characters');
      if (/[；]|——/.test(x.zh)) at(w, '.zh uses "；" or "——" (write 。 or ，)');
      if (withSource) cites(x.source, w);
    });
  };
  pairs(r.setup, 'setup', true);
  pairs(r.problems, 'problems', true);
  if (r.notes !== undefined) pairs(r.notes, 'notes', false);
  if (r.tbd !== undefined) pairs(r.tbd, 'tbd', false);
  // use: how OAV reaches it today, or null when it does not
  if (r.use !== null) {
    if (!Array.isArray(r.use) || !r.use.length) at('', 'use is a non-empty list, or null when OAV has no way to reach the device');
    else {
      pairs(r.use, 'use', false);
      r.use.forEach((u, i) => {
        if (!isObj(u)) return;
        if (!PACKAGE_RE.test(u.package || '')) at(`use[${i}]`, ': package is @openav/<name>');
        if (!text(u.entry)) at(`use[${i}]`, ': entry names the export it starts from');
        if (!text(u.call)) at(`use[${i}]`, ': call is the line of code');
        if (u.sink !== undefined && !ID_RE.test(u.sink)) at(`use[${i}]`, ': sink is an out-bridge sink name');
      });
    }
  }
  if (!text(r.license)) at('', 'license is an SPDX id (MIT, Apache-2.0…)');
  if (typeof r.verified !== 'boolean') at('', 'verified is true or false');
  if (!Array.isArray(r.verifications)) at('', 'verifications is a list');
  else r.verifications.forEach((v, i) => {
    if (!isObj(v) || !DATE_RE.test(v.date || '') || !text(v.by) || !VERIFY_METHODS.includes(v.method)) at(`verifications[${i}]`, `: needs date (YYYY-MM-DD), by and method (${VERIFY_METHODS.join(', ')})`);
  });
  if (r.verified === true && !(r.verifications || []).some((v) => v && v.method === 'hardware')) at('', 'verified is true but no verification has method "hardware": only a check on the unit itself makes it true');
  return errs;
}

/** The fields the collection lists and searches, for one record: what devices() returns. */
export function indexRow(r, from, file) {
  return { id: r.id, kind: r.kind, manufacturer: r.manufacturer, name: r.name, aliases: [...r.aliases], connections: [...r.connections],
    protocols: [...r.protocols], verified: r.verified, from, file };
}
