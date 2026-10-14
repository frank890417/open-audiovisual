#!/usr/bin/env node
// open-audiovisual MCP server — the agent's door into the framework.
//
// Model Context Protocol over stdio, hand-rolled on Node built-ins (zero
// dependencies, like everything here). Register it and any MCP-capable agent
// (Claude Code, Cursor…) can inspect the framework, read the layer contracts,
// scaffold a new performance, and verify it — the open-slide pattern applied
// to shows: describe a performance, the agent builds it inside the chassis.
//
//   { "mcpServers": { "openav": { "command": "node",
//       "args": ["packages/mcp/server.js"] } } }        // ← .mcp.json (shipped)
//
// Tools:
//   list_examples     what works exist (name, path, one-line summary)
//   read_doc          architecture / writing-a-world / signals / show-control / agents / … every handbook chapter
//   scaffold_world    copy a donor example into a new numbered example
//   run_checks        node --test — the same gate CI uses
//   list_controllers  every MIDI controller profile (id, maker, kind, control mix, unverified count, page URL)
//   read_profile      one profile in full + a human-readable MIDI map
//   validate_profile  validateProfile() problems for a JSON profile + port / id collisions with shipped ones
//   scaffold_profile  maker + model + control counts → a valid skeleton, every number "verified": false

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

const DOCS = {
  architecture: 'docs/architecture.md',
  'writing-a-world': 'docs/writing-a-world.md',
  signals: 'docs/signals.md',
  'show-control': 'docs/show-control.md',
  score: 'docs/score.md',
  roadmap: 'docs/roadmap.md',
  agents: 'AGENTS.md',
  readme: 'README.md',
  // the rest of the /docs/ handbook (https://openaudiovisual.com/docs/)
  introduction: 'docs/introduction.md',
  'getting-started': 'docs/getting-started.md',
  concepts: 'docs/concepts.md',
  inputs: 'docs/inputs.md',
  mapping: 'docs/mapping.md',
  controllers: 'docs/controllers.md',
  remote: 'docs/remote.md',
  packages: 'docs/packages.md',
  'agents-guide': 'docs/agents.md',
  troubleshooting: 'docs/troubleshooting.md',
  'lab-integration': 'docs/lab-integration.md',
};

const TOOLS = [
  {
    name: 'list_examples',
    description: 'List the example works in this open-audiovisual checkout: directory, title, first comment line.',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'read_doc',
    description: `Read a framework document. One of: ${Object.keys(DOCS).join(', ')}. Start with "agents" (conventions + the two unbreakable rules), then "writing-a-world".`,
    inputSchema: { type: 'object', properties: { doc: { type: 'string', enum: Object.keys(DOCS) } }, required: ['doc'] },
  },
  {
    name: 'scaffold_world',
    description: 'Create a new example by copying a donor (01-hello-particles = minimal canvas, 02-chord-garden = chord-driven, 03-pose-field = camera, 05-prebiotic-flake = p5 + sound). Returns the created paths; then edit the World in main.js.',
    inputSchema: {
      type: 'object',
      properties: {
        slug: { type: 'string', description: 'kebab-case name, e.g. "jellyfish-bloom"' },
        donor: { type: 'string', description: 'donor example dir name', default: '01-hello-particles' },
      },
      required: ['slug'],
    },
  },
  {
    name: 'list_controllers',
    description: 'List every MIDI controller profile shipped in packages/midi/profiles: id, name, maker, kind (device | generic), control mix (e.g. {knob: 8, pad: 8, keys: 25}), how many controls are still unverified, and the detail page URL.',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'read_profile',
    description: 'Read one controller profile in full (the JSON as shipped) plus a human-readable MIDI map: per control its type, the exact message (CC / note / pitch bend, channel), the midi/<short>/<id> signal and whether the number is verified.',
    inputSchema: { type: 'object', properties: { id: { type: 'string', description: 'profile id or short, e.g. "arturia-minilab3" or "minilab3"' } }, required: ['id'] },
  },
  {
    name: 'validate_profile',
    description: 'Check a controller profile (a JSON object or a JSON string) with the framework\'s own validateProfile(), and compare it with the shipped profiles: same id, same short (signal namespace), or port-name patterns that would claim the same device. Returns { ok, problems, conflicts }.',
    inputSchema: { type: 'object', properties: { profile: { description: 'the profile, as an object or a JSON string' } }, required: ['profile'] },
  },
  {
    name: 'scaffold_profile',
    description: 'Generate a valid skeleton profile for a new controller from its maker, model and control counts. Every number is a placeholder with "verified": false; nothing is written to disk. Returns { profile, problems, unverified, next_steps }.',
    inputSchema: {
      type: 'object',
      properties: {
        maker: { type: 'string', description: 'e.g. "Arturia"' },
        model: { type: 'string', description: 'e.g. "MiniLab 3"' },
        controls: {
          type: 'array',
          description: 'what is on the faceplate, e.g. [{"type":"knob","count":8},{"type":"pad","count":8},{"type":"keys","count":25,"from":48}]',
          items: {
            type: 'object',
            properties: {
              type: { type: 'string', enum: ['knob', 'encoder', 'fader', 'pad', 'button', 'keys', 'wheel', 'strip'] },
              count: { type: 'integer', minimum: 1 },
              from: { type: 'integer', description: 'keys only: lowest note (default 48)' },
            },
            required: ['type', 'count'],
          },
        },
      },
      required: ['maker', 'model', 'controls'],
    },
  },
  {
    name: 'run_checks',
    description: 'Run the framework test suite (node --test). Returns pass/fail summary and failures if any.',
    inputSchema: { type: 'object', properties: {} },
  },
];

function listExamples() {
  const dir = path.join(ROOT, 'examples');
  return fs.readdirSync(dir, { withFileTypes: true }).filter(d => d.isDirectory()).map(d => {
    let title = '', summary = '';
    try {
      const html = fs.readFileSync(path.join(dir, d.name, 'index.html'), 'utf8');
      title = /<title>([^<]*)/.exec(html)?.[1] ?? '';
      const main = fs.readFileSync(path.join(dir, d.name, 'main.js'), 'utf8');
      summary = (main.split('\n').find(l => l.startsWith('//')) || '').replace(/^\/\/\s*/, '');
    } catch (e) {}
    return { dir: `examples/${d.name}`, title, summary };
  });
}

function scaffoldWorld({ slug, donor = '01-hello-particles' }) {
  if (!/^[a-z0-9-]+$/.test(slug)) throw new Error('slug must be kebab-case');
  const src = path.join(ROOT, 'examples', donor);
  if (!fs.existsSync(src)) throw new Error(`unknown donor: ${donor}`);
  const nums = fs.readdirSync(path.join(ROOT, 'examples')).map(d => parseInt(d, 10)).filter(Number.isFinite);
  const next = String(Math.max(0, ...nums) + 1).padStart(2, '0');
  const destName = `${next}-${slug}`;
  const dest = path.join(ROOT, 'examples', destName);
  if (fs.existsSync(dest)) throw new Error(`already exists: ${destName}`);
  fs.mkdirSync(dest);
  for (const f of fs.readdirSync(src)) fs.copyFileSync(path.join(src, f), path.join(dest, f));
  return {
    created: `examples/${destName}`,
    next_steps: [
      `edit examples/${destName}/main.js — replace the World object (contract: docs/writing-a-world.md)`,
      `edit examples/${destName}/index.html — <title> and the #hint text`,
      `verify: node serve.js → http://localhost:8080/examples/${destName}/ (QWERTY piano must produce visible reaction)`,
    ],
  };
}

function runChecks() {
  try {
    const files = fs.readdirSync(path.join(ROOT, 'tests')).filter(f => f.endsWith('.test.js')).map(f => 'tests/' + f);
    const out = execFileSync('node', ['--test', ...files], { cwd: ROOT, encoding: 'utf8', timeout: 60000 });
    const pass = /# pass (\d+)/.exec(out)?.[1], fail = /# fail (\d+)/.exec(out)?.[1];
    return { pass: Number(pass), fail: Number(fail), ok: fail === '0' };
  } catch (e) {
    const out = (e.stdout || '') + (e.stderr || '');
    return { ok: false, output: out.split('\n').filter(l => /not ok|# (pass|fail)/.test(l)).join('\n') };
  }
}

// ---- controller profiles ----
const SITE = 'https://openaudiovisual.com';
let _prof; // lazy: the profile JSON imports need Node 22; the other tools must work without them
async function profiles() {
  if (!_prof) {
    const [idx, lib] = await Promise.all([import('../midi/profiles/index.js'), import('../midi/profiles.js')]);
    _prof = { list: idx.PROFILES, byId: idx.profileById, validateProfile: lib.validateProfile, RESERVED_SHORTS: lib.RESERVED_SHORTS };
  }
  return _prof;
}
const physical = (c) => (c.type === 'keys' ? c.to - c.from + 1 : 1);
const mix = (p) => { const m = {}; for (const c of p.controls) m[c.type] = (m[c.type] || 0) + physical(c); return m; };
const unverifiedOf = (p) => p.controls.filter((c) => c.verified === false).reduce((a, c) => a + physical(c), 0);
const pageUrl = (id) => `${SITE}/controllers/${id}/`;

async function listControllers() {
  const { list } = await profiles();
  const controllers = list.map((p) => ({
    id: p.id, short: p.short, name: p.name, maker: p.maker || null, kind: p.kind,
    controls: mix(p), unverified: unverifiedOf(p), url: pageUrl(p.id),
  }));
  return { count: controllers.length, controllers };
}

function humanMsg(c, ch) {
  const on = `ch ${ch}`;
  if (c.type === 'keys') return `notes ${c.from}–${c.to} (${c.to - c.from + 1} keys), ${on}`;
  if (c.msg === 'cc') return `CC ${c.cc}, ${on}` + (c.type === 'encoder' ? (c.relative === false ? ', absolute' : `, relative ${c.relative ?? 'offset64'}`) : '');
  if (c.msg === 'note') return `note ${c.note}, ${on}` + (c.mode ? `, ${c.mode}` : '');
  if (c.msg === 'pitchbend') return `pitch bend, ${on}`;
  if (c.msg === 'chanat') return `channel pressure, ${on}`;
  return `${c.msg}, ${on}`;
}

async function readProfile({ id }) {
  const { byId, list } = await profiles();
  const p = byId(id);
  if (!p) throw new Error(`unknown profile: ${id}. Known: ${list.map((x) => x.id).join(', ')}`);
  const ch0 = p.channel ?? 1;
  const mapping = p.controls.map((c) => ({
    control: c.id, type: c.type, message: humanMsg(c, c.ch ?? ch0),
    signal: c.type === 'keys' ? `midi/${p.short}/${c.id}/on · /off · n<note>` : `midi/${p.short}/${c.id}`,
    verified: c.verified !== false,
    ...(c.led ? { led: c.led.msg === 'note' ? `note ${c.led.note ?? c.note}` : `CC ${c.led.cc ?? c.cc}` } : {}),
    ...(typeof c.note === 'string' ? { note: c.note } : {}),
  }));
  return { id: p.id, url: pageUrl(p.id), unverified: unverifiedOf(p), profile: p, mapping };
}

async function validateProfileTool({ profile }) {
  const { list, validateProfile } = await profiles();
  let p = profile;
  if (typeof p === 'string') { try { p = JSON.parse(p); } catch (e) { return { ok: false, problems: [`not valid JSON: ${e.message}`], conflicts: [] }; } }
  const problems = validateProfile(p);
  const conflicts = [];
  const rx = (r) => { try { return new RegExp(r, 'i'); } catch { return null; } };
  if (p && typeof p === 'object') {
    const mine = (p.match?.ports || []).filter((r) => rx(r));
    for (const o of list) {
      if (o.id === p.id) conflicts.push({ with: o.id, kind: 'id', detail: `id "${p.id}" is already a shipped profile` });
      if (p.short && o.short === p.short) conflicts.push({ with: o.id, kind: 'short', detail: `short "${p.short}" is already the signal namespace midi/${o.short}/…` });
      if (p.kind === 'device' && o.kind === 'device') {
        const theirs = o.match?.ports || [];
        for (const r of mine) {
          const same = theirs.includes(r);
          const hitsTheirName = [o.name, `${o.maker || ''} ${o.name}`, o.short].some((n) => rx(r).test(n || ''));
          const theyHitMine = theirs.some((t) => [p.name, p.short].some((n) => n && rx(t)?.test(n)));
          if (same || hitsTheirName || theyHitMine) conflicts.push({ with: o.id, kind: 'port', detail: `port pattern "${r}" ${same ? 'is identical to one of' : 'overlaps'} ${o.id}'s ${JSON.stringify(theirs)}; matchProfile() could not tell the two apart` });
        }
      }
    }
  }
  const seen = new Set();
  return { ok: !problems.length && !conflicts.length, problems, conflicts: conflicts.filter((c) => { const k = c.with + c.kind; return seen.has(k) ? false : (seen.add(k), true); }) };
}

const slug = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
async function scaffoldProfile({ maker, model, controls }) {
  const { list, validateProfile, RESERVED_SHORTS } = await profiles();
  if (!maker || !model) throw new Error('maker and model are required');
  if (!Array.isArray(controls) || !controls.length) throw new Error('controls must be a non-empty array like [{ "type": "knob", "count": 8 }]');
  const TYPES = ['knob', 'encoder', 'fader', 'pad', 'button', 'keys', 'wheel', 'strip'];
  let cc = 20, note = 36;
  const nextCC = () => { if (cc > 127) throw new Error('too many controls for placeholder CC numbers (about 108 at most)'); return cc++; };
  const out = [], sections = [], warnings = [], counters = {};
  // placeholder pad notes must not land on a key range (two controls on one message fail validation)
  const keyNotes = new Set();
  for (const s of controls) if (s?.type === 'keys' && Number.isInteger(s.count)) for (let n = 0; n < s.count; n++) keyNotes.add((s.from ?? 48) + n);
  const nextNote = () => { while (keyNotes.has(note)) note++; if (note > 127) throw new Error('too many pads for placeholder notes'); return note++; };
  let y = 2;
  for (const spec of controls) {
    if (!TYPES.includes(spec?.type)) throw new Error(`unknown control type "${spec?.type}" (use ${TYPES.join(', ')})`);
    const n = spec.count;
    if (!Number.isInteger(n) || n < 1 || n > 128) throw new Error(`count for ${spec.type} must be an integer 1..128`);
    const ids = [];
    if (spec.type === 'keys') {
      const from = spec.from ?? 48;
      if (from < 0 || from + n - 1 > 127) throw new Error('keys must stay within notes 0..127');
      const k = counters.keys = (counters.keys || 0) + 1;
      const id = k > 1 ? `keys${k}` : 'keys';
      out.push({ id, type: 'keys', label: 'Keys', msg: 'note', from, to: from + n - 1, verified: false, note: 'range assumed: check the manual (octave shift moves it)' });
      ids.push(id);
    } else for (let i = 0; i < n; i++) {
      const k = counters[spec.type] = (counters[spec.type] || 0) + 1;
      const base = { id: `${spec.type}${k}`, type: spec.type, verified: false };
      if (spec.type === 'pad') out.push({ ...base, msg: 'note', note: nextNote() });
      else if (spec.type === 'button') out.push({ ...base, msg: 'cc', cc: nextCC(), mode: 'momentary' });
      else if (spec.type === 'encoder') out.push({ ...base, msg: 'cc', cc: nextCC(), relative: 'offset64' });
      else if (spec.type === 'wheel' && !out.some((c) => c.msg === 'pitchbend')) out.push({ ...base, msg: 'pitchbend' });
      else out.push({ ...base, msg: 'cc', cc: nextCC() }); // knob · fader · strip · extra wheels (one pitch bend per channel)
      ids.push(base.id);
    }
    const cols = spec.type === 'keys' ? 1 : Math.min(ids.length, 8), rows = Math.ceil(ids.length / cols);
    const h = Math.max(8, rows * 7);
    sections.push({ id: `${spec.type}s-${sections.length + 1}`, label: spec.type, x: 2, y, w: 96, h, cols, rows, controls: ids });
    y += h + 2;
  }
  const makerSlug = slug(maker), modelSlug = slug(model);
  const id = modelSlug.startsWith(makerSlug) ? modelSlug : `${makerSlug}-${modelSlug}`;
  let short = modelSlug.replace(/-/g, '');
  if (RESERVED_SHORTS.includes(short)) short = id.replace(/-/g, '');
  const rx = String(model).trim().split(/\s+/).map((w) => w.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('\\s*');
  const profile = {
    id, short, name: `${maker} ${model}`, maker, kind: 'device', channel: 1,
    match: { ports: [rx], avoid: ['din thru', 'mcu'] },
    sources: [{ title: `TODO: ${maker} ${model} MIDI implementation chart or user manual (cite the exact page)`, note: 'every number below is a placeholder until a source confirms it' }],
    notes: 'Scaffolded skeleton: every number is an unverified placeholder. Replace each with the value from a source, then drop "verified": false.',
    face: { w: 100, h: y },
    sections,
    controls: out,
  };
  const dup = list.find((p) => p.id === profile.id || p.short === profile.short);
  if (dup) warnings.push(`id or short collides with shipped profile "${dup.id}": rename before registering`);
  return {
    profile,
    problems: validateProfile(profile),
    unverified: out.reduce((a, c) => a + physical(c), 0),
    ...(warnings.length ? { warnings } : {}),
    next_steps: [
      `find the source: the manufacturer's MIDI implementation chart or user manual for ${maker} ${model}; cite it in sources[] with a title, a url and what it confirmed`,
      'replace each placeholder CC / note / channel with the documented value; remove "verified": false only for numbers a source confirms (keep it, with a note, for anything guessed)',
      'check match.ports / match.avoid against the real port names, then run validate_profile to catch collisions with shipped profiles',
      'adjust sections[] to the real faceplate layout (x, y, w, h in face units)',
      `save as packages/midi/profiles/${profile.id}.json, import it in packages/midi/profiles/index.js, then run node tools/build-controllers.mjs and node --test tests/*.test.js`,
      'Learn mode rebinds a wrong number on a real unit, so a flagged placeholder is safe to ship',
    ],
  };
}

// ---- minimal MCP (JSON-RPC 2.0 over stdio, newline-delimited) ----
const respond = (id, result) => process.stdout.write(JSON.stringify({ jsonrpc: '2.0', id, result }) + '\n');
const fail = (id, message) => process.stdout.write(JSON.stringify({ jsonrpc: '2.0', id, error: { code: -32000, message } }) + '\n');

let buf = '';
process.stdin.on('data', (chunk) => {
  buf += chunk;
  let nl;
  while ((nl = buf.indexOf('\n')) >= 0) {
    const line = buf.slice(0, nl).trim();
    buf = buf.slice(nl + 1);
    if (!line) continue;
    let msg;
    try { msg = JSON.parse(line); } catch (e) { continue; }
    handle(msg).catch((e) => msg.id !== undefined && fail(msg.id, e.message));
  }
});

async function handle(msg) {
  const { id, method, params } = msg;
  if (method === 'initialize') {
    return respond(id, {
      protocolVersion: params?.protocolVersion || '2024-11-05',
      capabilities: { tools: {} },
      serverInfo: { name: 'openav', version: '0.1.0' },
    });
  }
  if (method === 'notifications/initialized') return;      // notification, no reply
  if (method === 'tools/list') return respond(id, { tools: TOOLS });
  if (method === 'tools/call') {
    const { name, arguments: args = {} } = params;
    try {
      let out;
      if (name === 'list_examples') out = listExamples();
      else if (name === 'read_doc') out = fs.readFileSync(path.join(ROOT, DOCS[args.doc]), 'utf8');
      else if (name === 'scaffold_world') out = scaffoldWorld(args);
      else if (name === 'run_checks') out = runChecks();
      else if (name === 'list_controllers') out = await listControllers();
      else if (name === 'read_profile') out = await readProfile(args);
      else if (name === 'validate_profile') out = await validateProfileTool(args);
      else if (name === 'scaffold_profile') out = await scaffoldProfile(args);
      else return fail(id, `unknown tool: ${name}`);
      return respond(id, { content: [{ type: 'text', text: typeof out === 'string' ? out : JSON.stringify(out, null, 2) }] });
    } catch (e) { return fail(id, e.message); }
  }
  if (id !== undefined) fail(id, `unknown method: ${method}`);
}
