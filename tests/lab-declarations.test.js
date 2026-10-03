// The `lab` field in packages/<pkg>/package.json is how a package declares that the
// cheyuwu-lab should integrate it (the lab's generator builds runtime/modules/<module>.js
// from it and grows /remote tabs from `remoteTab`). Keep every declaration buildable.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DEFAULT_PLUGIN_TABS } from '../packages/remote/app.js';

const PK = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'packages');
const decls = [];
for (const dir of fs.readdirSync(PK)) {
  const f = path.join(PK, dir, 'package.json');
  if (!fs.existsSync(f)) continue;
  const pkg = JSON.parse(fs.readFileSync(f, 'utf8'));
  if (pkg.lab) for (const d of [].concat(pkg.lab)) decls.push({ dir, pkg: pkg.name, ...d });
}
const exportedNames = (src) => {
  const out = new Set();
  for (const m of src.matchAll(/^export\s+(?:async\s+)?(?:class|function\*?|const|let|var)\s+([A-Za-z_$][\w$]*)/gm)) out.add(m[1]);
  for (const m of src.matchAll(/^export\s*\{([^}]*)\}\s*(?:from\s*['"][^'"]+['"])?\s*;?/gm)) for (const part of m[1].split(',')) { const n = part.trim().split(/\s+as\s+/).pop(); if (n) out.add(n); }
  return out;
};

test('every lab declaration is complete and buildable', () => {
  assert.ok(decls.length >= 9);
  const names = new Set();
  for (const d of decls) {
    const at = `${d.pkg} → ${d.module}`;
    assert.match(d.module || '', /^[a-z][a-z0-9-]*$/, at);
    assert.ok(!names.has(d.module), `${at}: module name used twice`); names.add(d.module);
    assert.ok(d.since, `${at}: since`);
    if (d.kind === 'declare') { assert.ok(d.note, `${at}: a declare-only module explains itself`); continue; }
    assert.ok(Array.isArray(d.files) && d.files.length, `${at}: files`);
    const exported = new Set();
    for (const f of d.files) {
      const p = path.join(PK, f);
      assert.ok(fs.existsSync(p), `${at}: missing ${f}`);
      for (const n of exportedNames(fs.readFileSync(p, 'utf8'))) exported.add(n);
    }
    for (const e of d.exports || []) assert.ok(exported.has(e), `${at}: "${e}" is not exported by its files`);
    if (d.wire) {
      const w = fs.readFileSync(path.join(PK, d.dir, d.wire), 'utf8');
      assert.doesNotMatch(w, /^\s*(import|export)\s/m, `${at}: a wire is a snippet, not a module`);
      assert.doesNotThrow(() => new Function('lab', 'OpenAV', `(async () => {\n${w}\n})`), `${at}: wire parses`);
    }
    assert.ok(typeof d.autowire === 'string' && d.autowire.length > 10, `${at}: autowire says how it reaches lab.signals`);
  }
});

test('remote tabs: the app\'s built-in default list equals the declarations', async () => {
  const declared = decls.filter((d) => d.remoteTab).map((d) => d.remoteTab);
  assert.deepEqual(DEFAULT_PLUGIN_TABS, declared);
  for (const t of declared) {
    assert.ok(fs.existsSync(path.join(PK, t.entry)), t.entry);
    const mod = await import(path.join(PK, t.entry));
    assert.equal(typeof mod.mount, 'function', `${t.entry} exports mount(el, ctx)`);
  }
});
