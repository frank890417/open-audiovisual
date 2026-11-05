#!/usr/bin/env node
// import-qlc — bring QLC+'s input profiles into this project.
//
//   git clone --depth 1 https://github.com/mcallegari/qlcplus
//   node tools/import-qlc.mjs ../qlcplus             # writes packages/midi/profiles/imported/ and fills gaps in existing files
//   node tools/import-qlc.mjs ../qlcplus --dry-run   # says what it would do
//
// Only QLC+: its folder is Apache-2.0. Mixxx (GPL) and midi.guide (CC-BY-SA) stay out, their licences do not fit an MIT library people
// build closed products on. Each file records the path and commit it came from; NOTICE at the root says the rest.

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { validateProfile } from '../packages/midi/profiles.js';
import { PROFILES } from '../packages/midi/profiles/index.js';
import { SKIP, EXISTING, profileFromQxi, enrichFromQxi } from './qlc/import.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIR = path.join(ROOT, 'packages/midi/profiles');
const OUT = path.join(DIR, 'imported');
const write = (f, p) => fs.writeFileSync(f, JSON.stringify(p, null, 1) + '\n');

function main([repo, ...flags]) {
  if (!repo) { console.error('usage: node tools/import-qlc.mjs <path to a qlcplus checkout> [--dry-run]'); return 2; }
  const dry = flags.includes('--dry-run');
  const folder = path.join(repo, 'resources/inputprofiles');
  const commit = execFileSync('git', ['-C', repo, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  const date = execFileSync('git', ['-C', repo, 'log', '-1', '--format=%cs'], { encoding: 'utf8' }).trim();
  const files = fs.readdirSync(folder).filter((f) => f.endsWith('.qxi')).sort();
  const taken = new Set(PROFILES.flatMap((p) => [p.id, p.short]));
  const fresh = [], report = { commit, skipped: [], enriched: [], added: [] };
  for (const file of files) {
    const xml = fs.readFileSync(path.join(folder, file), 'utf8');
    if (SKIP[file]) { report.skipped.push(`${file}: ${SKIP[file]}`); continue; }
    if (EXISTING[file]) {
      const target = fs.readdirSync(DIR).find((f) => f === `${EXISTING[file]}.json`);
      const raw = JSON.parse(fs.readFileSync(path.join(DIR, target), 'utf8'));
      const { profile, added, disagree } = enrichFromQxi(raw, xml, { file, commit });
      const problems = validateProfile(profile);
      if (problems.length) throw new Error(`${file}: ${problems.join(' | ')}`);
      report.enriched.push({ file, into: EXISTING[file], palette: added.palette, leds: added.leds.length, onlyInQlc: disagree.length, sample: disagree.slice(0, 4) });
      if (!dry) write(path.join(DIR, target), profile);
      continue;
    }
    const p = profileFromQxi(xml, { file, commit, date });
    if (taken.has(p.id)) throw new Error(`${file}: id ${p.id} is taken`);
    for (let n = 2; taken.has(p.short); n++) p.short = `${p.short.replace(/\d+$/, '')}${n}`;
    taken.add(p.id); taken.add(p.short);
    const problems = validateProfile(p);
    if (problems.length) throw new Error(`${file}: ${problems.join(' | ')}`);
    fresh.push({ file, p });
    report.added.push(`${p.id} (${p.controls.length} controls${p.palette ? ', palette' : ''})`);
  }
  if (!dry) {
    fs.mkdirSync(OUT, { recursive: true });
    for (const { p } of fresh) write(path.join(OUT, `${p.id}.json`), p);
    const rows = fresh.map(({ p }) => `  { id: ${JSON.stringify(p.id)}, short: ${JSON.stringify(p.short)}, name: ${JSON.stringify(p.name)}, maker: ${JSON.stringify(p.maker)}, kind: 'device', match: { ports: ${JSON.stringify(p.match.ports)} } },`).join('\n');
    fs.writeFileSync(path.join(DIR, 'imported.js'), `// @openav/midi · profiles/imported — controllers imported from QLC+ (tools/import-qlc.mjs writes this list).
// Their JSON files stay out of PROFILES so a page that embeds one controller does not fetch them all;
// resolveProfile() fetches the one it is asked for. Each row carries its match patterns, so matchProfile() can tell which file a port wants
// before any of them is loaded. The data is Apache-2.0: see NOTICE at the root of the repository.

export const IMPORTED = [
${rows}
];

/** Where an imported profile's JSON lives, or null for an id or short name that is not one of them. */
export function importedUrl(ref) {
  const hit = IMPORTED.find((p) => p.id === ref || p.short === ref);
  return hit ? new URL(\`./imported/\${hit.id}.json\`, import.meta.url).href : null;
}
`);
  }
  console.log(JSON.stringify(report, null, 1));
  return 0;
}

process.exit(main(process.argv.slice(2)));
