#!/usr/bin/env node
// export-controller — one controller profile as files other software reads.
//
//   node tools/export-controller.mjs akai-lpd8                    # id, short name, or a path to a JSON profile
//   node tools/export-controller.mjs akai-lpd8 --to qxi           # qxi | mixxx | all (default)
//   node tools/export-controller.mjs akai-lpd8 --out ~/Desktop    # default: the current folder
//   node tools/export-controller.mjs --all --out exports          # every device
//
// Writes <id>.qxi (QLC+ input profile) and <id>.midi.xml + <id>.scripts.js (Mixxx mapping). The site writes the same
// files next to each device page (tools/build-controllers.mjs). The logic is packages/midi/export.js.

import fs from 'node:fs';
import path from 'node:path';
import { PROFILES, profileById } from '../packages/midi/profiles/index.js';
import { validateProfile } from '../packages/midi/profiles.js';
import { toQxi, toMixxx } from '../packages/midi/export.js';

/** The files of one profile: { name: text }. */
export function exportFiles(profile, to = 'all') {
  const out = {};
  if (to === 'all' || to === 'qxi') out[`${profile.id}.qxi`] = toQxi(profile);
  if (to === 'all' || to === 'mixxx') { const m = toMixxx(profile); out[m.xmlName] = m.xml; out[m.jsName] = m.js; }
  return out;
}

function main(argv) {
  const arg = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
  const to = arg('--to', 'all'), out = arg('--out', '.');
  if (!['all', 'qxi', 'mixxx'].includes(to)) { console.error(`--to must be qxi, mixxx or all (got ${to})`); return 2; }
  const skip = new Set(['--to', '--out'].flatMap((k) => { const i = argv.indexOf(k); return i >= 0 ? [i, i + 1] : []; }));
  const refs = argv.filter((a, i) => !skip.has(i) && !a.startsWith('--'));
  const list = argv.includes('--all') ? PROFILES.filter((p) => p.kind === 'device') : refs.map((r) => (fs.existsSync(r) ? JSON.parse(fs.readFileSync(r, 'utf8')) : profileById(r)));
  if (!list.length || list.some((p) => !p)) { console.error('usage: node tools/export-controller.mjs <id | file.json> [--to qxi|mixxx|all] [--out dir] | --all [--out dir]'); return 2; }
  fs.mkdirSync(out, { recursive: true });
  for (const p of list) {
    const problems = validateProfile(p);
    if (problems.length) { console.error(`${p.id}:\n  ${problems.join('\n  ')}`); return 1; }
    for (const [name, text] of Object.entries(exportFiles(p, to))) { fs.writeFileSync(path.join(out, name), text); console.log(path.join(out, name)); }
  }
  return 0;
}

if (process.argv[1] && path.resolve(process.argv[1]) === new URL(import.meta.url).pathname) process.exit(main(process.argv.slice(2)));
