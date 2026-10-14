// The MCP server over stdio: tools/list and the four controller tools (list_controllers,
// read_profile, validate_profile, scaffold_profile). The server runs as a child process,
// the way an agent starts it; nothing here touches the network or writes files.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { PROFILES } from '../packages/midi/profiles/index.js';
import { validateProfile } from '../packages/midi/profiles.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let child, buf = '', next = 1;
const waiting = new Map();

before(() => {
  child = spawn('node', [path.join(ROOT, 'packages/mcp/server.js')], { cwd: ROOT, stdio: ['pipe', 'pipe', 'inherit'] });
  child.stdout.on('data', (d) => {
    buf += d;
    let nl;
    while ((nl = buf.indexOf('\n')) >= 0) {
      const msg = JSON.parse(buf.slice(0, nl)); buf = buf.slice(nl + 1);
      waiting.get(msg.id)?.(msg); waiting.delete(msg.id);
    }
  });
});
after(() => child.kill());

const rpc = (method, params) => new Promise((resolve, reject) => {
  const id = next++;
  const t = setTimeout(() => reject(new Error(`no reply to ${method}`)), 15000);
  waiting.set(id, (m) => { clearTimeout(t); resolve(m); });
  child.stdin.write(JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n');
});
const call = async (name, args = {}) => {
  const m = await rpc('tools/call', { name, arguments: args });
  if (m.error) return { error: m.error.message };
  return JSON.parse(m.result.content[0].text);
};

test('initialize and tools/list name the four controller tools next to the originals', async () => {
  const init = await rpc('initialize', {});
  assert.equal(init.result.serverInfo.name, 'openav');
  const { tools } = (await rpc('tools/list')).result;
  const names = tools.map((t) => t.name);
  for (const n of ['list_examples', 'read_doc', 'scaffold_world', 'run_checks', 'list_controllers', 'read_profile', 'validate_profile', 'scaffold_profile']) assert.ok(names.includes(n), n);
  for (const t of tools) assert.equal(t.inputSchema.type, 'object', t.name);
  assert.deepEqual(tools.find((t) => t.name === 'scaffold_profile').inputSchema.required, ['maker', 'model', 'controls']);
});

test('list_controllers: one row per shipped profile, with mix, unverified count and page URL', async () => {
  const r = await call('list_controllers');
  assert.equal(r.count, PROFILES.length);
  assert.equal(r.controllers.length, PROFILES.length);
  const ml = r.controllers.find((c) => c.id === 'arturia-minilab3');
  assert.equal(ml.name, 'Arturia MiniLab 3');
  assert.equal(ml.maker, 'Arturia');
  assert.equal(ml.kind, 'device');
  assert.equal(ml.controls.keys, 25);
  assert.equal(ml.controls.knob, 8);
  assert.equal(ml.url, 'https://openaudiovisual.com/controllers/arturia-minilab3/');
  const lpd8 = r.controllers.find((c) => c.id === 'akai-lpd8');
  assert.equal(lpd8.unverified, 8);
  assert.ok(r.controllers.some((c) => c.kind === 'generic'));
  for (const c of r.controllers) assert.match(c.url, /^https:\/\/openaudiovisual\.com\/controllers\/[a-z0-9-]+\/$/);
});

test('read_profile: full JSON plus a readable map; accepts id or short; unknown id is an error', async () => {
  const r = await call('read_profile', { id: 'arturia-minilab3' });
  assert.equal(r.profile.id, 'arturia-minilab3');
  assert.equal(r.mapping.length, r.profile.controls.length);
  const k1 = r.mapping.find((m) => m.control === 'knob1');
  assert.match(k1.message, /^CC \d+, ch 1$/);
  assert.equal(k1.signal, 'midi/minilab3/knob1');
  assert.equal(k1.verified, true);
  assert.match(r.mapping.find((m) => m.control === 'keys').message, /^notes 48–72 \(25 keys\)/);
  assert.equal(r.mapping.find((m) => m.control === 'enc').verified, false);
  assert.match(r.mapping.find((m) => m.control === 'pad1').message, /^note \d+, ch 10/);
  assert.equal((await call('read_profile', { id: 'minilab3' })).id, 'arturia-minilab3');
  assert.match((await call('read_profile', { id: 'nope' })).error, /unknown profile/);
});

test('validate_profile: a broken file lists its problems; a clone of a shipped one lists the collisions', async () => {
  const bad = await call('validate_profile', { profile: { id: 'Bad Id', kind: 'device', controls: [{ id: 'a', type: 'knob', msg: 'cc', cc: 200 }] } });
  assert.equal(bad.ok, false);
  assert.ok(bad.problems.some((p) => /id "Bad Id"/.test(p)));
  assert.ok(bad.problems.some((p) => /cc must be 0..127/.test(p)));
  assert.ok(bad.problems.some((p) => /cite at least one source/.test(p)));

  const notJson = await call('validate_profile', { profile: '{oops' });
  assert.equal(notJson.ok, false);
  assert.match(notJson.problems[0], /not valid JSON/);

  const clone = JSON.parse(JSON.stringify(PROFILES.find((p) => p.id === 'arturia-minilab3')));
  const same = await call('validate_profile', { profile: JSON.stringify(clone) });
  assert.deepEqual(same.problems, []);
  assert.equal(same.ok, false);
  assert.deepEqual([...new Set(same.conflicts.map((c) => c.kind))].sort(), ['id', 'port', 'short']);

  clone.id = 'my-minilab'; clone.short = 'mylab';           // renamed, but the port pattern still claims a MiniLab 3
  const portOnly = await call('validate_profile', { profile: clone });
  assert.deepEqual(portOnly.conflicts.map((c) => c.kind), ['port']);
  assert.equal(portOnly.conflicts[0].with, 'arturia-minilab3');
});

test('scaffold_profile: a skeleton that passes validateProfile, every number unverified, with next steps', async () => {
  const r = await call('scaffold_profile', { maker: 'Acme', model: 'Pad Pro 16', controls: [
    { type: 'knob', count: 8 }, { type: 'pad', count: 16 }, { type: 'fader', count: 2 }, { type: 'encoder', count: 1 },
    { type: 'button', count: 4 }, { type: 'keys', count: 25, from: 48 }, { type: 'wheel', count: 1 },
  ] });
  assert.deepEqual(r.problems, []);
  assert.deepEqual(validateProfile(r.profile), []);
  assert.equal(r.profile.id, 'acme-pad-pro-16');
  assert.equal(r.profile.kind, 'device');
  assert.equal(r.profile.controls.length, 8 + 16 + 2 + 1 + 4 + 1 + 1);
  assert.ok(r.profile.controls.every((c) => c.verified === false));
  assert.equal(r.unverified, 8 + 16 + 2 + 1 + 4 + 25 + 1);
  assert.deepEqual(r.profile.match.ports, ['pad\\s*pro\\s*16']);
  assert.ok(r.profile.sources[0].title.startsWith('TODO'));
  assert.ok(r.next_steps.length >= 4 && r.next_steps.some((s) => /source|manual|implementation chart/.test(s)));
  // it also survives the round trip through the validator tool, with no collision against shipped devices
  const again = await call('validate_profile', { profile: r.profile });
  assert.equal(again.ok, true, JSON.stringify(again));
});

test('scaffold_profile: refuses nonsense and warns on a name collision', async () => {
  assert.match((await call('scaffold_profile', { maker: 'A', model: 'B', controls: [{ type: 'joystick', count: 1 }] })).error, /unknown control type/);
  assert.match((await call('scaffold_profile', { maker: 'A', model: 'B', controls: [] })).error, /non-empty/);
  assert.match((await call('scaffold_profile', { maker: 'A', model: 'B', controls: [{ type: 'pad', count: 200 }] })).error, /count/);
  const dup = await call('scaffold_profile', { maker: 'Arturia', model: 'MiniLab 3', controls: [{ type: 'knob', count: 2 }] });
  assert.deepEqual(dup.problems, []);
  assert.ok(dup.warnings.some((w) => /collides/.test(w)));
  const two = await call('scaffold_profile', { maker: 'X', model: 'Y', controls: [{ type: 'wheel', count: 2 }] });
  assert.deepEqual(two.problems, []);   // one pitch-bend wheel per channel, the second falls back to a CC
});
