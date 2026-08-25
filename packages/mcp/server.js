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
//   read_doc          architecture / writing-a-world / signals / show-control / agents
//   scaffold_world    copy a donor example into a new numbered example
//   run_checks        node --test — the same gate CI uses

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
  roadmap: 'docs/roadmap.md',
  agents: 'AGENTS.md',
  readme: 'README.md',
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
    handle(msg);
  }
});

function handle(msg) {
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
      else return fail(id, `unknown tool: ${name}`);
      return respond(id, { content: [{ type: 'text', text: typeof out === 'string' ? out : JSON.stringify(out, null, 2) }] });
    } catch (e) { return fail(id, e.message); }
  }
  if (id !== undefined) fail(id, `unknown method: ${method}`);
}
