// The page signature (packages/core/src/signature.js): one <meta name="generator"> tag, nothing sent, and one
// version number for the whole framework.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { VERSION, sign } from '../packages/core/index.js';
import { VERSION as TELEMETRY_VERSION } from '../packages/midi/telemetry.js';

function fakeDoc(existing = []) {
  const metas = existing.map((content) => ({ attrs: { name: 'generator', content }, getAttribute(k) { return this.attrs[k]; } }));
  return {
    metas,
    head: {
      querySelectorAll: (sel) => { assert.equal(sel, 'meta[name="generator"]'); return metas; },
      appendChild: (m) => { metas.push(m); return m; },
    },
    createElement: (tag) => { assert.equal(tag, 'meta'); return { attrs: {}, setAttribute(k, v) { this.attrs[k] = v; }, getAttribute(k) { return this.attrs[k]; } }; },
  };
}

test('sign() adds one generator tag that names the framework and its version', () => {
  const doc = fakeDoc();
  const meta = sign(doc);
  assert.equal(meta.getAttribute('name'), 'generator');
  assert.equal(meta.getAttribute('content'), `open-audiovisual ${VERSION}`);
  assert.equal(doc.metas.length, 1);
});

test('sign() twice leaves one tag; another generator on the page stays', () => {
  const doc = fakeDoc(['Hugo 0.140']);
  const first = sign(doc);
  assert.equal(sign(doc), first);
  assert.deepEqual(doc.metas.map((m) => m.getAttribute('content')), ['Hugo 0.140', `open-audiovisual ${VERSION}`]);
});

test('a second product of the project signs beside the framework', () => {
  const doc = fakeDoc();
  sign(doc);
  sign(doc, { product: 'oav-p5', version: '9.9.9 (open-audiovisual)' });
  assert.deepEqual(doc.metas.map((m) => m.getAttribute('content')), [`open-audiovisual ${VERSION}`, 'oav-p5 9.9.9 (open-audiovisual)']);
});

test('sign() without a document (Node, a worker) does nothing', () => {
  assert.equal(sign(undefined), null);
  assert.equal(sign({}), null);
});

test('one version: package.json, core and the telemetry hit agree, and it is a semver', () => {
  const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
  assert.match(VERSION, /^\d+\.\d+\.\d+$/);
  assert.equal(pkg.version, VERSION);
  assert.equal(TELEMETRY_VERSION, VERSION);
});

test('createShow signs the page unless signature is false, and sends nothing to do it', () => {
  const show = readFileSync(new URL('../packages/show/index.js', import.meta.url), 'utf8');
  assert.match(show, /if \(signature !== false\) sign\(\);/);
  const sig = readFileSync(new URL('../packages/core/src/signature.js', import.meta.url), 'utf8');
  assert.doesNotMatch(sig, /fetch\(|sendBeacon|XMLHttpRequest|WebSocket|new Image/);
});
