// The device collection as the site sees it: every device, where its page is, and whether it gets one. Synchronous and
// read off disk, so the page register (tools/site/pages.mjs), the generator (tools/build-devices.mjs), llms.txt, the search
// index and the tests all ask the same function and cannot disagree.
//
//   collectionRows()     every device, in collection order (kind, then name): what packages/devices/catalog.js lists
//   collection()         the same devices with what the pages need: { row, record, profile?, part?, offers, page, href(locale) }
//   offers(row, record)  what a page of its own could carry: something operable, a snippet that runs, a file to take
//   PAGE_MIN             a device gets a page of its own when it offers at least two of the three
//
// Where a page lives: a MIDI controller keeps /controllers/<id>/ (those addresses are indexed and do not move); a DMX
// fixture is /fixtures/<id>/; everything else that qualifies is /devices/<id>/. A device below PAGE_MIN stays a row in the
// hub, linked to its record file. Nothing here writes a file.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { KINDS, validateDevice, indexRow } from '../../packages/devices/record.js';
import { fromMidiProfile, fromFixture, fromPart } from '../../packages/devices/derive.js';
import { PARTS } from '../../packages/hw/parts.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const PKGS = path.join(ROOT, 'packages');
const jsonFiles = (rel) => (fs.existsSync(path.join(PKGS, rel)) ? fs.readdirSync(path.join(PKGS, rel)).filter((f) => f.endsWith('.json') && !f.endsWith('.schema.json')).sort() : []);
const readJson = (rel) => JSON.parse(fs.readFileSync(path.join(PKGS, rel), 'utf8'));

/** Every device source on disk: [{ from, file (inside packages/), id }]. */
export function sourcesOnDisk() {
  const out = [];
  for (const f of jsonFiles('midi/profiles')) out.push({ from: 'midi-profile', file: `midi/profiles/${f}`, id: f.replace(/\.json$/, '') });
  for (const f of jsonFiles('midi/profiles/imported')) out.push({ from: 'midi-profile', file: `midi/profiles/imported/${f}`, id: f.replace(/\.json$/, '') });
  for (const f of jsonFiles('dmx/fixtures')) out.push({ from: 'dmx-fixture', file: `dmx/fixtures/${f}`, id: f.replace(/\.json$/, '') });
  for (const f of jsonFiles('dmx/fixtures/imported')) out.push({ from: 'dmx-fixture', file: `dmx/fixtures/imported/${f}`, id: f.replace(/\.json$/, '') });   // tools/import-ofl.mjs writes here
  for (const f of jsonFiles('devices/records')) out.push({ from: 'device-record', file: `devices/records/${f}`, id: f.replace(/\.json$/, '') });
  return out;
}

/** Every device with its full record: [{ row, record, data (the file it is read off), from, file }], in collection order. */
export function collectionEntries() {
  const out = [];
  const problems = [];
  const add = (record, from, file, data) => {
    for (const e of validateDevice(record)) problems.push(`${file}: ${e}`);
    out.push({ row: indexRow(record, from, file), record, data, from, file });
  };
  for (const s of sourcesOnDisk()) {
    const data = readJson(s.file);
    if (data.id !== s.id) problems.push(`${s.file}: its id is "${data.id}", the file name says "${s.id}"`);
    if (s.from === 'midi-profile') add(fromMidiProfile(data, { file: s.file }), s.from, s.file, data);
    else if (s.from === 'dmx-fixture') add(fromFixture(data, { file: s.file }), s.from, s.file, data);
    else add(data, s.from, s.file, data);
  }
  for (const [id, part] of Object.entries(PARTS)) add(fromPart(id, part, { file: 'hw/parts.js' }), 'hw-part', 'hw/parts.js', part);
  const seen = new Map();
  for (const e of out) { if (seen.has(e.row.id)) problems.push(`id "${e.row.id}" is used by ${seen.get(e.row.id)} and ${e.file}`); seen.set(e.row.id, e.file); }
  if (problems.length) throw new Error('device collection:\n  ' + problems.join('\n  '));
  const order = new Map(KINDS.map((k, i) => [k, i]));
  out.sort((a, b) => order.get(a.row.kind) - order.get(b.row.kind) || a.row.name.localeCompare(b.row.name, 'en', { sensitivity: 'base' }) || a.row.id.localeCompare(b.row.id));
  return out;
}

/** The rows devices() answers from, in collection order. */
export const collectionRows = () => collectionEntries().map((e) => e.row);

// --------------------------------------------------------------------------- the rule: two of three, or no page of its own
/** A device gets a page of its own when it offers at least this many of: something operable, a snippet that runs, a file to take. */
export const PAGE_MIN = 2;

/**
 * What a page of its own could carry for this device, each true only when the site has it today:
 *   operable  an on-screen controller (MIDI), a virtual fixture (DMX), a live helper behind a button (a camera or an audio input,
 *             through the record's find() and open()), or the frame an Enttec DMX USB Pro would receive (its encoder in @openav/dmx)
 *   snippet   OAV has code that reaches it (the record's `use` is not null)
 *   file      a file to take away: the profile, the fixture, the record, or the part's library entry as JSON
 */
export function offers(row, record) {
  const k = row.kind;
  const operable = k === 'midi-controller' || k === 'dmx-fixture' || k === 'camera' || k === 'audio-interface' || row.protocols.includes('enttec-usb-pro');
  const snippet = Array.isArray(record.use) && record.use.length > 0;
  const file = ['midi-profile', 'dmx-fixture', 'device-record', 'hw-part'].includes(row.from);
  return { operable, snippet, file, count: [operable, snippet, file].filter(Boolean).length };
}

/** Where a device's page is (path under the site root, no "zh/"), or null when it has none. */
export function pagePathOf(row, record) {
  if (offers(row, record).count < PAGE_MIN) return null;
  if (row.kind === 'midi-controller') return `controllers/${row.id}/`;
  if (row.kind === 'dmx-fixture') return `fixtures/${row.id}/`;
  return `devices/${row.id}/`;
}

export const HUB_PATH = 'devices/';
export const fixturePath = (id) => `fixtures/${id}/`;
export const devicePath = (id) => `devices/${id}/`;

/** Every device with its page, in collection order. `page` is null for a device that stays a row in the hub. */
export function collection() {
  return collectionEntries().map((e) => ({ ...e, offers: offers(e.row, e.record), page: pagePathOf(e.row, e.record) }));
}

/** The devices this generator writes pages for (fixtures and /devices/ pages; the controllers' pages are build-controllers'). */
export function ownPages(list = collection()) {
  return list.filter((d) => d.page && d.row.kind !== 'midi-controller');
}

/** The register entries (tools/site/pages.mjs): the hub, then one per fixture, then one per device page. */
export function registerEntries(list = collection()) {
  const own = ownPages(list);
  return [
    { id: 'devices', path: HUB_PATH, langs: ['en', 'zh'], src: ['packages/devices/catalog.js', 'tools/devices/hub.mjs', 'tools/devices/en.mjs', 'tools/devices/zh.mjs', 'assets/devices/hub.js'], group: 'devices' },
    ...own.filter((d) => d.row.kind === 'dmx-fixture').map((d) => ({ id: 'fixtures/' + d.row.id, path: d.page, langs: ['en', 'zh'], src: [`packages/${d.file}`], group: 'fixtures' })),
    ...own.filter((d) => d.row.kind !== 'dmx-fixture').map((d) => ({ id: 'devices/' + d.row.id, path: d.page, langs: ['en', 'zh'], src: [`packages/${d.file}`], group: 'device-pages' })),
  ];
}
