// Platform facts in the docs (2026-10): Web MIDI by browser, the iPad routes, Windows 11's built-in MIDI
// loopback, Chrome's Local Network Access, TouchDesigner's Web Render TOP. Each of these is a claim about
// somebody else's software, so each one carries its source: a paragraph or list item that names a browser
// version, a platform feature or a vendor product has an external link in the same item, and the English and
// Chinese pages cite the same sources.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

export const SRC = {
  chromeMidi: 'https://developer.chrome.com/blog/web-midi-permission-prompt',
  firefox108: 'https://developer.mozilla.org/en-US/docs/Mozilla/Firefox/Releases/108',
  caniuse: 'https://caniuse.com/midi',
  webkit: 'https://webkit.org/tracking-prevention/',
  webkitBug: 'https://bugs.webkit.org/show_bug.cgi?id=107250',
  midiweb: 'https://apps.apple.com/app/midiweb-browser/id6757226617',
  safariExt: 'https://github.com/triglav-modular/Safari-WebMIDI',
  windows: 'https://blogs.windows.com/windowsexperience/2026/02/17/making-music-with-midi-just-got-a-real-boost-in-windows-11/',
  lna: 'https://developer.chrome.com/blog/local-network-access',
  lnaStatus: 'https://chromestatus.com/feature/5197681148428288',
  webRender: 'https://docs.derivative.ca/Web_Render_TOP',
};

/** doc → the sources it must cite (the same list for the Chinese twin) */
const MUST = {
  'docs/getting-started.md': ['chromeMidi', 'firefox108', 'caniuse', 'webkit', 'webkitBug', 'midiweb', 'safariExt', 'windows'],
  'docs/troubleshooting.md': ['chromeMidi', 'firefox108', 'webkitBug', 'lna', 'lnaStatus'],
  'docs/controllers.md': ['windows', 'webkitBug'],
  'docs/show-control.md': ['webRender', 'lna'],
};
const twin = (f) => f.replace('docs/', 'docs/zh/');

test('platform docs: every page cites its sources, and the zh twin cites the same ones', () => {
  for (const [file, keys] of Object.entries(MUST)) {
    for (const f of [file, twin(file)]) {
      const s = read(f);
      for (const k of keys) assert.ok(s.includes(SRC[k]), `${f} cites ${k} (${SRC[k]})`);
    }
  }
});

test('platform docs: the package READMEs that talk to localhost say what Chrome asks, with the source', () => {
  for (const f of ['packages/osc/README.md', 'packages/monitor/README.md']) {
    const s = read(f);
    assert.ok(s.includes(SRC.lna), `${f} cites the Local Network Access post`);
    assert.match(s, /Local Network Access|local network/i, `${f} names the prompt`);
    assert.ok(s.includes('/docs/#troubleshooting-'), `${f} points at the troubleshooting section`);
  }
  assert.ok(read('packages/osc/README.md').includes(SRC.lnaStatus));
});

// Every item (paragraph or bullet) in a platform section that names a browser version / platform feature / vendor
// product has an external link inside the same item.
const NAMES = /Chrome 1\d\d|Chrome\b.*\b(?:asks|prompt)|Firefox|Safari|WebKit|iPad|Windows MIDI|loopMIDI|Windows 11|Local Network|loopback|Web Render|WebGPU|targetAddressSpace/;
const SECTIONS = [
  ['docs/getting-started.md', /^## Which browser/m, /^## 用哪個瀏覽器/m],
  ['docs/troubleshooting.md', /^## Chrome asks about/m, /^## Chrome 跳出/m],
  ['docs/controllers.md', /^## Play your DAW with it/m, /^## 用它彈你的 DAW/m],
  ['docs/show-control.md', /^### TouchDesigner as the receiver|^### TouchDesigner/m, /^### TouchDesigner/m],
];
function section(md, re) {
  const m = re.exec(md);
  assert.ok(m, `heading ${re} exists`);
  const rest = md.slice(m.index + m[0].length);
  const end = rest.search(/^#{1,3} /m);
  return md.slice(m.index, m.index + m[0].length + (end < 0 ? rest.length : end));
}
function items(sec) {
  const out = [];
  for (const para of sec.split(/\n\s*\n/)) {
    if (/^\s*```/.test(para)) continue;
    const lines = para.split('\n');
    let cur = null;
    for (const l of lines) {
      if (/^\s*([-*]|\d+\.)\s/.test(l)) { if (cur) out.push(cur); cur = l; }
      else if (cur === null) cur = l;
      else cur += ' ' + l.trim();
    }
    if (cur) out.push(cur);
  }
  return out.filter((x) => !/^#{1,6} /.test(x));
}
test('platform docs: every platform claim has a source link in the same paragraph or bullet', () => {
  for (const [file, en, zh] of SECTIONS) {
    for (const [f, re] of [[file, en], [twin(file), zh]]) {
      const sec = section(read(f), re);
      const named = items(sec).filter((x) => NAMES.test(x));
      assert.ok(named.length >= 1, `${f}: the section names at least one platform fact`);
      for (const it of named) assert.match(it, /\]\(https:\/\/(?!openaudiovisual\.com)/, `${f}: no source link in: ${it.slice(0, 90)}`);
    }
  }
});

test('platform docs: unverified claims are marked as such', () => {
  const gs = read('docs/getting-started.md'), gz = read('docs/zh/getting-started.md');
  assert.match(gs, /third[- ]party/i); assert.match(gz, /第三方/);
  assert.match(gs, /not tested|untested|have not tried|have not tested/i); assert.match(gz, /沒有[^。]{0,40}實測|未實測|沒測過/);
  const c = read('docs/controllers.md'), cz = read('docs/zh/controllers.md');
  assert.match(c, /loopMIDI/); assert.match(cz, /loopMIDI/, 'loopMIDI stays as the older-Windows route');
  assert.match(c, /not tested|untested|have not tried|have not tested/i); assert.match(cz, /沒有[^。]{0,40}實測|未實測|沒測過/);
});

test('platform docs: loopMIDI is no longer the only Windows answer', () => {
  for (const f of ['docs/controllers.md', 'docs/zh/controllers.md', 'tools/controllers/en.mjs', 'tools/controllers/zh.mjs']) {
    const s = read(f);
    assert.match(s, /Windows MIDI Services/, `${f} names the built-in route`);
  }
});

test('platform docs: the troubleshooting section for the local-network prompt exists, with the Chrome versions and the fix', () => {
  const en = section(read('docs/troubleshooting.md'), /^## Chrome asks about/m);
  for (const v of ['142', '147', '154', 'targetAddressSpace', 'loopback-network', 'allow=']) assert.ok(en.includes(v), `en mentions ${v}`);
  assert.match(en, /localhost/);
  const zh = section(read('docs/zh/troubleshooting.md'), /^## Chrome 跳出/m);
  for (const v of ['142', '147', '154', 'targetAddressSpace', 'loopback-network', 'allow=']) assert.ok(zh.includes(v), `zh mentions ${v}`);
});

test('platform docs: the device check is linked from the getting-started and troubleshooting pages (both languages)', () => {
  for (const f of ['docs/getting-started.md', 'docs/troubleshooting.md']) assert.ok(read(f).includes('https://openaudiovisual.com/check/'), f);
  for (const f of ['docs/zh/getting-started.md', 'docs/zh/troubleshooting.md']) assert.ok(read(f).includes('https://openaudiovisual.com/zh/check/'), f);
});

test('platform docs: the facts carry the date they were checked', () => {
  assert.match(read('docs/getting-started.md'), /2026-10/);
  assert.match(read('docs/troubleshooting.md'), /2026-10/);
});
