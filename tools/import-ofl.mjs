#!/usr/bin/env node
// import-ofl — bring fixtures from the Open Fixture Library into this project's format (open-audiovisual/fixture@1).
//
//   git clone --depth 1 https://github.com/OpenLightingProject/open-fixture-library ../ofl
//   node tools/import-ofl.mjs ../ofl fixtures/chauvet-dj/slimpar-t12-bt.json [more files…]   # writes packages/dmx/fixtures/imported/
//   node tools/import-ofl.mjs ../ofl fixtures/… --dry-run                                     # prints what it would write
//   node tools/import-ofl.mjs ../ofl fixtures/… --out some/folder
//
// One fixture at a time, by name: a bulk import belongs to the equipment-collection work, not here. OFL is MIT; each file records
// the path and commit it came from, and NOTICE at the root says the rest. The conversion itself is tools/ofl/import.mjs.

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { validateFixture } from '../packages/dmx/fixture.js';
import { FIXTURES } from '../packages/dmx/fixtures/index.js';
import { fixtureFromOfl } from './ofl/import.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function main(args) {
  const flags = args.filter((a) => a.startsWith('--'));
  const rest = args.filter((a, i) => !a.startsWith('--') && args[i - 1] !== '--out');
  const [repo, ...files] = rest;
  if (!repo || !files.length) { console.error('usage: node tools/import-ofl.mjs <path to an OFL checkout> <fixtures/<maker>/<fixture>.json …> [--dry-run] [--out dir]'); return 2; }
  const dry = flags.includes('--dry-run');
  const outAt = args.indexOf('--out');
  const out = outAt >= 0 ? path.resolve(args[outAt + 1]) : path.join(ROOT, 'packages/dmx/fixtures/imported');
  const commit = execFileSync('git', ['-C', repo, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  const date = new Date().toISOString().slice(0, 10);
  const makers = JSON.parse(fs.readFileSync(path.join(repo, 'fixtures/manufacturers.json'), 'utf8'));
  const taken = new Set(FIXTURES.map((f) => f.id));
  const report = { commit, written: [], skipped: [] };
  for (const file of files) {
    const rel = file.replace(/\\/g, '/');
    const ofl = JSON.parse(fs.readFileSync(path.join(repo, rel), 'utf8'));
    const maker = rel.split('/')[1];
    const { fixture, skipped } = fixtureFromOfl(ofl, { file: rel, commit, manufacturer: makers[maker] && makers[maker].name, date });
    const problems = validateFixture(fixture);
    if (problems.length) throw new Error(`${rel}: ${problems.join(' | ')}`);
    if (taken.has(fixture.id)) throw new Error(`${rel}: id ${fixture.id} is a shipped fixture`);
    taken.add(fixture.id);
    for (const s of skipped) report.skipped.push(`${fixture.id}: ${s}`);
    report.written.push(`${fixture.id} (${fixture.modes.map((m) => m.id).join(', ')})`);
    if (dry) console.log(JSON.stringify(fixture, null, 1));
    else { fs.mkdirSync(out, { recursive: true }); fs.writeFileSync(path.join(out, `${fixture.id}.json`), JSON.stringify(fixture, null, 1) + '\n'); }
  }
  console.error(JSON.stringify(report, null, 1));
  return 0;
}

process.exit(main(process.argv.slice(2)));
