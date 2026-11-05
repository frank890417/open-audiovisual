// /controllers/verify/ and /zh/controllers/verify/: the page exists in both languages, every device links to it, and it says
// what it asks for. Reads the committed files, so it also catches "generator not rerun". The behaviour is in verify-session.test.js
// and, in a real browser, p5/test/verify-smoke.cjs.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PROFILES } from '../packages/midi/profiles/index.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const PAGES = { en: 'controllers/verify/index.html', zh: 'zh/controllers/verify/index.html' };

test('both languages exist, list every profile, and carry the same controls', () => {
  const ids = (s) => [...s.matchAll(/ id="(vf-[\w-]+)"/g)].map((m) => m[1]).sort();
  const en = read(PAGES.en), zh = read(PAGES.zh);
  for (const [lang, s] of Object.entries({ en, zh })) {
    for (const p of PROFILES) assert.ok(s.includes(`<option value="${p.id}">`), `${lang}: ${p.id} can be picked`);
    assert.match(s, /assets\/controllers\/verify\.js/);
    assert.ok(/<title>/.test(s) && /rel="canonical"/.test(s), `${lang}: has its head`);
  }
  assert.match(en, /<html lang="en"/); assert.match(zh, /<html lang="zh/);
  assert.deepEqual(ids(en), ids(zh));
});

test('every device page and the gallery lead to it, in their own language', () => {
  for (const p of PROFILES.filter((x) => x.kind === 'device')) {
    assert.ok(read(`controllers/${p.id}/index.html`).includes(`controllers/verify/?profile=${p.id}`), `${p.id} en`);
    assert.ok(read(`zh/controllers/${p.id}/index.html`).includes(`zh/controllers/verify/?profile=${p.id}`), `${p.id} zh`);
  }
  for (const f of ['controllers/index.html', 'zh/controllers/index.html']) assert.ok(read(f).includes('href="verify/"'), f);
});

test('the page asks for nothing on load: SysEx only inside the Read button, MIDI only inside Connect', () => {
  const js = read('assets/controllers/verify.js');
  assert.ok(!/requestMIDIAccess/.test(js), 'it goes through the Midi engine');
  const at = (needle) => js.indexOf(needle);
  assert.ok(at("$('vf-connect').addEventListener") < at('midi.enable()'), 'enable() sits inside the Connect handler');
  assert.ok(at("$('vf-read-fw').addEventListener") < at('midi.requestSysex()'), 'requestSysex() sits inside the Read handler');
  assert.equal(js.match(/requestSysex/g).length, 1, 'and nowhere else');
});

test('a device page says how far hardware checks have got, and the table keeps the three levels apart', () => {
  const lpd8 = read('controllers/akai-lpd8/index.html');
  assert.match(lpd8, /Checked on hardware/);
  assert.match(lpd8, /not yet/);
  assert.match(lpd8, /from source|unverified/);
  assert.ok(!PROFILES.some((p) => p.controls.some((c) => c.verified === true)), 'no shipped control claims a hardware check yet');
});
