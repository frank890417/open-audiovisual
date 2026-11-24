#!/usr/bin/env node
// import-ofl — bring fixtures from the Open Fixture Library into this project's format (open-audiovisual/fixture@1).
//
//   git clone https://github.com/OpenLightingProject/open-fixture-library ../ofl && git -C ../ofl checkout <commit>
//   node tools/import-ofl.mjs ../ofl --list tools/ofl/batch-1.json          # a batch: the list names its files and its commit
//   node tools/import-ofl.mjs ../ofl fixtures/chauvet-dj/slimpar-t12-bt.json [more files…]   # or files by name
//   node tools/import-ofl.mjs ../ofl … --dry-run                            # prints what it would write
//   node tools/import-ofl.mjs ../ofl … --out some/folder
//
// Writes packages/dmx/fixtures/imported/<id>.json, one per fixture, then the list of every file in that folder:
// packages/dmx/fixtures/imported-list.js (ids, names, modes: what a page lists without loading 40 files) and imported.js
// (loadImportedFixture(id), which imports the one it is asked for). Nothing imports the JSON files eagerly.
// Each fixture is converted by tools/ofl/import.mjs and must pass tools/ofl/gates.mjs (no inverted dimmer, no key the engine
// cannot reach, no mode that stays dark or shut at rest, a manual to check against); a file that fails one stops the import,
// with the reason. A batch list says which OFL commit it was chosen at, and the checkout must be at that commit.
// OFL is MIT; each file records the path and commit it came from, and NOTICE at the root says the rest.

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { validateFixture } from '../packages/dmx/fixture.js';
import { FIXTURES } from '../packages/dmx/fixtures/index.js';
import { fixtureFromOfl } from './ofl/import.mjs';
import { importProblems } from './ofl/gates.mjs';
import { isMain } from './site/is-main.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const IMPORTED_DIR = 'packages/dmx/fixtures/imported';
export const LIST_FILE = 'packages/dmx/fixtures/imported-list.js';
export const URL_FILE = 'packages/dmx/fixtures/imported.js';

/** The row a page lists a fixture by, read off its file. */
export const rowOf = (f) => ({ id: f.id, manufacturer: f.manufacturer, name: f.name, kind: f.kind, modes: f.modes.map((m) => ({ id: m.id, footprint: m.channels.length })) });

/** imported-list.js and imported.js for the fixtures in packages/dmx/fixtures/imported/ (sorted by id). */
export function listFiles(fixtures) {
  const rows = [...fixtures].sort((a, b) => a.id.localeCompare(b.id)).map(rowOf);
  return {
    [LIST_FILE]: `// @openav/dmx · fixtures/imported-list — fixtures imported from the Open Fixture Library (tools/import-ofl.mjs writes this list).
// Their JSON files stay out of FIXTURES, so a page that patches one light does not fetch ${rows.length}: loadImportedFixture(id) in
// imported.js imports the one it is asked for. Each row is read off its file: id, manufacturer, name, kind and each mode's footprint.
// The data is MIT (Open Fixture Library): see NOTICE at the root of the repository. None of it has been checked on a light.

export const IMPORTED_FIXTURES = [
${rows.map((r) => '  ' + JSON.stringify(r)).join(',\n')},
];

/** The row for an imported fixture's id, or null. */
export function importedFixtureRow(id) {
  return IMPORTED_FIXTURES.find((f) => f.id === id) || null;
}
`,
    [URL_FILE]: `// @openav/dmx · fixtures/imported — the fixtures imported from the Open Fixture Library, one at a time (tools/import-ofl.mjs writes
// this file). The list is imported-list.js; this file imports a fixture's JSON when it is asked for, by a path relative to
// itself (no import.meta, so it runs wherever the package does). The data is MIT (Open Fixture Library): see NOTICE.

import { IMPORTED_FIXTURES, importedFixtureRow } from './imported-list.js';

export { IMPORTED_FIXTURES };

/** Where an imported fixture's JSON is inside @openav/dmx ("fixtures/imported/<id>.json"), or null for an id that is not one. */
export function importedFixturePath(id) {
  const hit = importedFixtureRow(id);
  return hit ? \`fixtures/imported/\${hit.id}.json\` : null;
}

/** The fixture profile (open-audiovisual/fixture@1) of an imported fixture, imported when it is asked for. Pass it to a Patch:
 *  new Patch({ profiles: [await loadImportedFixture(id)] }), or patch.add({ profile: it, … }). */
export async function loadImportedFixture(id) {
  const hit = importedFixtureRow(id);
  if (!hit) throw new Error(\`no imported fixture "\${id}"\`);
  return (await import(\`./imported/\${hit.id}.json\`, { with: { type: 'json' } })).default;
}
`,
  };
}

/** Every fixture file in packages/dmx/fixtures/imported/, parsed. */
export function importedOnDisk(dir = path.join(ROOT, IMPORTED_DIR)) {
  return fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => f.endsWith('.json')).sort().map((f) => JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'))) : [];
}

function main(args) {
  const flags = args.filter((a) => a.startsWith('--'));
  const valueOf = (k) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : null; };
  const rest = args.filter((a, i) => !a.startsWith('--') && args[i - 1] !== '--out' && args[i - 1] !== '--list');
  const [repo, ...named] = rest;
  const listArg = valueOf('--list');
  if (!repo || (!named.length && !listArg)) { console.error('usage: node tools/import-ofl.mjs <path to an OFL checkout> (--list <batch.json> | <fixtures/<maker>/<fixture>.json …>) [--dry-run] [--out dir]'); return 2; }
  const dry = flags.includes('--dry-run');
  const outArg = valueOf('--out');
  const out = outArg ? path.resolve(outArg) : path.join(ROOT, IMPORTED_DIR);
  const commit = execFileSync('git', ['-C', repo, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  let files = named;
  if (listArg) {
    const list = JSON.parse(fs.readFileSync(path.resolve(listArg), 'utf8'));
    if (list.commit && list.commit !== commit) { console.error(`${listArg} was chosen at OFL ${list.commit}; the checkout is at ${commit}: git -C ${repo} checkout ${list.commit}`); return 1; }
    files = [...list.fixtures, ...named];
  }
  const date = new Date().toISOString().slice(0, 10);
  const makers = JSON.parse(fs.readFileSync(path.join(repo, 'fixtures/manufacturers.json'), 'utf8'));
  const taken = new Set(FIXTURES.map((f) => f.id));
  const report = { commit, written: [], skipped: [] };
  const problems = [];
  const made = [];
  for (const file of files) {
    const rel = file.replace(/\\/g, '/');
    const ofl = JSON.parse(fs.readFileSync(path.join(repo, rel), 'utf8'));
    const maker = rel.split('/')[1];
    const { fixture, skipped } = fixtureFromOfl(ofl, { file: rel, commit, manufacturer: makers[maker] && makers[maker].name, date });
    const invalid = validateFixture(fixture);
    if (invalid.length) { problems.push(`${rel}: ${invalid.join(' | ')}`); continue; }
    const gates = importProblems(ofl, fixture);
    if (gates.length) { problems.push(`${rel}: ${gates.join(' | ')}`); continue; }
    if (taken.has(fixture.id)) { problems.push(`${rel}: id ${fixture.id} is taken`); continue; }
    taken.add(fixture.id);
    for (const s of skipped) report.skipped.push(`${fixture.id}: ${s}`);
    report.written.push(`${fixture.id} (${fixture.modes.map((m) => m.id).join(', ')})`);
    made.push(fixture);
  }
  if (problems.length) { console.error('not imported (nothing was written):\n  ' + problems.join('\n  ')); return 1; }
  if (dry) { for (const f of made) console.log(JSON.stringify(f, null, 1)); }
  else {
    fs.mkdirSync(out, { recursive: true });
    for (const f of made) fs.writeFileSync(path.join(out, `${f.id}.json`), JSON.stringify(f, null, 1) + '\n');
    if (!outArg) for (const [rel, text] of Object.entries(listFiles(importedOnDisk()))) fs.writeFileSync(path.join(ROOT, rel), text);
  }
  console.error(JSON.stringify(report, null, 1));
  return 0;
}

if (isMain(import.meta.url)) process.exit(main(process.argv.slice(2)));
