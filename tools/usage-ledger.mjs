#!/usr/bin/env node
// usage-ledger — one line of "who uses this" numbers, from sources that take nothing from anyone.
//
//   node tools/usage-ledger.mjs                 # print this week's row as JSON
//   node tools/usage-ledger.mjs --md            # the same row as a Markdown table line (with --header: the header first)
//   node tools/usage-ledger.mjs --append f.jsonl  # also append the row to a file (GitHub keeps traffic for 14 days only)
//
// What it reads, and from where (each is skipped, with a note, when it cannot be reached):
//   stars, forks, open issues        GitHub REST (public)
//   views, clones, referrers         GitHub traffic (needs `gh` signed in as someone with push access; last 14 days)
//   code that names the framework    GitHub code search, repositories other than this one (needs `gh` signed in)
//   pinned-version downloads         jsDelivr's public stats for the GitHub repository (the tags a page can pin)
//   works on /made-with/             made-with/works.json, and how many are not by the author of the framework
//   controllers checked on hardware  profiles with a hardware entry in their verifications log
//   loads of the entry files         Cloudflare's analytics for the zone: how many times /p5/oav-p5.js and
//                                    /packages/openav.js were requested in the last 7 whole days (UTC). Only with
//                                    CLOUDFLARE_API_TOKEN set to a READ-ONLY token (Zone: Read, Analytics: Read):
//                                      CLOUDFLARE_API_TOKEN=$(security find-generic-password -s <name> -w) node tools/usage-ledger.mjs
//                                    Counts only: the free plan gives no referrer, and keeps about 30 days, so a row
//                                    not written down is gone.
// It sends nothing but these read requests, and it needs no key of its own. Not part of the build or the tests.

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const REPO = 'frank890417/open-audiovisual';
const AUTHOR = 'Che-Yu Wu';
export const SEARCHES = ['"openaudiovisual.com/p5/oav-p5.js"', '"openaudiovisual.com/packages"', '"open-audiovisual@"', '"oav-controller"'];

const notes = [];
function gh(args) {
  try { return JSON.parse(execFileSync('gh', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })); }
  catch (e) { notes.push(`gh ${args.slice(0, 2).join(' ')}: ${String(e.stderr || e.message).trim().split('\n')[0]}`); return null; }
}
async function getJson(url) {
  try { const r = await fetch(url, { headers: { 'user-agent': 'open-audiovisual usage-ledger' } }); if (!r.ok) throw new Error(r.status + ''); return await r.json(); }
  catch (e) { notes.push(`${new URL(url).host}: ${e.message}`); return null; }
}

/** Repositories of other people whose code names the framework: { total, repos: [...] }. The owner's own repositories
 *  (this one, and private ones a signed-in search can see) are left out. Pure part: tested. */
export function externalRepos(hits, own = REPO) {
  const owner = own.split('/')[0] + '/';
  const repos = [...new Set((hits || []).map((h) => h.repository?.nameWithOwner).filter((r) => r && !r.startsWith(owner)))].sort();
  return { total: repos.length, repos };
}

/** Works on the page, and how many someone other than the framework's author made. Pure: tested. */
export function countWorks(data, author = AUTHOR) {
  const works = data?.works || [];
  return { works: works.length, byOthers: works.filter((w) => w.by !== author).length };
}

/** Profiles whose verifications log has an entry made on the real unit. Pure: tested. */
export function countVerified(profiles) {
  return profiles.filter((p) => (p.verifications || []).some((v) => v && (v.method === 'hardware' || v.hardware === true))).length;
}

export const ENTRY_FILES = { oavP5: '/p5/oav-p5.js', openav: '/packages/openav.js' };

/** The GraphQL request for one week of requests to the entry files: one aliased count per file. Pure: tested. */
export function loadsQuery(zoneTag, from, to, files = ENTRY_FILES) {
  const part = ([k, p]) => `${k}: httpRequestsAdaptiveGroups(limit: 1, filter: { datetime_geq: $a, datetime_lt: $b, clientRequestPath: ${JSON.stringify(p)}, requestSource: "eyeball" }) { count }`;
  return {
    query: `query($z: String!, $a: Time!, $b: Time!) { viewer { zones(filter: { zoneTag: $z }) { ${Object.entries(files).map(part).join(' ')} } } }`,
    variables: { z: zoneTag, a: from, b: to },
  };
}

/** The counts out of the answer: { oavP5: 420, openav: 3 }; a file nobody asked for is 0. Pure: tested. */
export function readLoads(answer, files = ENTRY_FILES) {
  const zone = answer?.data?.viewer?.zones?.[0];
  if (!zone) return null;
  return Object.fromEntries(Object.keys(files).map((k) => [k, zone[k]?.[0]?.count ?? 0]));
}

async function cloudflareLoads() {
  const token = process.env.CLOUDFLARE_API_TOKEN;
  if (!token) { notes.push('cloudflare: CLOUDFLARE_API_TOKEN not set, loads skipped'); return null; }
  const call = async (url, body) => {
    const r = await fetch(url, { method: body ? 'POST' : 'GET', headers: { authorization: 'Bearer ' + token, 'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
    return r.json();
  };
  try {
    const zone = (await call('https://api.cloudflare.com/client/v4/zones?name=openaudiovisual.com'))?.result?.[0]?.id;
    if (!zone) throw new Error('zone not found (does the token read this zone?)');
    const to = new Date(); to.setUTCHours(0, 0, 0, 0);
    const from = new Date(to.getTime() - 7 * 864e5);
    const answer = await call('https://api.cloudflare.com/client/v4/graphql', loadsQuery(zone, from.toISOString(), to.toISOString()));
    if (answer.errors?.length) throw new Error(answer.errors[0].message);
    return { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10), ...readLoads(answer) };
  } catch (e) { notes.push('cloudflare: ' + e.message); return null; }
}

export function toMarkdown(row, header = false) {
  const cols = [['date', row.date], ['stars', row.github.stars], ['forks', row.github.forks], ['views 14d', row.github.views14d], ['clones 14d', row.github.clones14d],
    ['external repos', row.code.total], ['jsDelivr month', row.jsdelivr.month], ['oav-p5.js 7d', row.loads?.oavP5], ['openav.js 7d', row.loads?.openav], ['works', row.madeWith.works], ['by others', row.madeWith.byOthers], ['verified', row.controllers.verified]];
  const line = '| ' + cols.map(([, v]) => v ?? '–').join(' | ') + ' |';
  return header ? `| ${cols.map(([k]) => k).join(' | ')} |\n|${cols.map(() => '---').join('|')}|\n${line}` : line;
}

async function collect() {
  const repo = await getJson(`https://api.github.com/repos/${REPO}`);
  const views = gh(['api', `repos/${REPO}/traffic/views`]);
  const clones = gh(['api', `repos/${REPO}/traffic/clones`]);
  const refs = gh(['api', `repos/${REPO}/traffic/popular/referrers`]);
  const hits = [];
  for (const q of SEARCHES) hits.push(...(gh(['search', 'code', q, '--limit', '50', '--json', 'repository']) || []));
  const loads = await cloudflareLoads();
  const jd = await getJson(`https://data.jsdelivr.com/v1/stats/packages/gh/${REPO}?period=month`);
  const works = JSON.parse(fs.readFileSync(path.join(ROOT, 'made-with/works.json'), 'utf8'));
  const dir = path.join(ROOT, 'packages/midi/profiles');
  const files = [...fs.readdirSync(dir), ...fs.readdirSync(path.join(dir, 'imported')).map((f) => 'imported/' + f)].filter((f) => f.endsWith('.json'));
  const profiles = files.map((f) => JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')));
  return {
    date: new Date().toISOString().slice(0, 10),
    github: {
      stars: repo?.stargazers_count ?? null, forks: repo?.forks_count ?? null, openIssues: repo?.open_issues_count ?? null,
      views14d: views?.count ?? null, visitors14d: views?.uniques ?? null, clones14d: clones?.count ?? null, cloners14d: clones?.uniques ?? null,
      referrers: (refs || []).map((r) => `${r.referrer} ${r.count}`),
    },
    code: externalRepos(hits),
    jsdelivr: { month: jd?.hits?.total ?? null, rank: jd?.hits?.rank ?? null },
    loads,
    madeWith: countWorks(works),
    controllers: { profiles: profiles.length, verified: countVerified(profiles) },
    notes,
  };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const row = await collect();
  const i = process.argv.indexOf('--append');
  if (i > 0 && process.argv[i + 1]) fs.appendFileSync(process.argv[i + 1], JSON.stringify(row) + '\n');
  console.log(process.argv.includes('--md') ? toMarkdown(row, process.argv.includes('--header')) : JSON.stringify(row, null, 2));
}
