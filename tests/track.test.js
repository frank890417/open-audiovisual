// assets/track.js: what the site's own pages count (docs/controllers.md, "The site's own pages").
//
// The rules held here: the mapping from a click, a copy, a control or a key to an event is pure and says only what the
// list says; no param can carry an address, a query string or anything typed; without window.gtag the script does
// nothing at all; every page of the site says what kind of page it is and loads the script once; and the files other
// people's pages load (p5/oav-p5.js, packages/, embed/) never load it or send any of its events.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const exists = (rel) => fs.existsSync(path.join(ROOT, rel));
const SRC = read('assets/track.js');

/** The script's pure half, run in a sandbox that has no window and no document. */
function api() {
  const raw = {};
  vm.runInNewContext(SRC, { __OAV_TRACK_TEST__: raw, URL });
  // objects made in the sandbox have its prototypes: copy them out, so deepStrictEqual compares plain values
  const plain = (v) => (v && typeof v === 'object' ? JSON.parse(JSON.stringify(v)) : v);
  return Object.fromEntries(Object.entries(raw).map(([k, v]) => [k, typeof v === 'function' ? (...a) => plain(v(...a)) : plain(v)]));
}
const T = api();
const NAMES = Object.keys(T.SPEC).map((k) => 'oav_' + k);
const TOKEN = /^[a-z0-9_.-]{1,40}$/;

// ---------------------------------------------------------------------------- the mapping
test('track: a click, a copy, a control, a search and a key map to the listed events and params', () => {
  const page = { pageType: 'controller', pageId: 'akai-lpd8', here: 'openaudiovisual.com' };
  const click = (d) => T.fromClick({ ...page, ...d });
  assert.deepEqual(NAMES.sort(), ['oav_controller_play', 'oav_copy', 'oav_example_start', 'oav_export_download', 'oav_lang_switch', 'oav_next_step', 'oav_outbound', 'oav_search'].sort());
  for (const k of Object.keys(T.SPEC)) assert.ok(T.SPEC[k].length <= 3, `${k}: at most three params`);

  // copy: what was copied, never the text
  const loader = "document.head.prepend(Object.assign(document.createElement('script'), { src: 'https://openaudiovisual.com/p5/oav-p5.js' }));";
  assert.deepEqual(click({ copyButton: true, text: `window.OAV_P5 = { profile: 'akai-lpd8' };\n${loader}` }), { name: 'oav_copy', params: { kind: 'loader', page_type: 'controller' } });
  assert.deepEqual(click({ copyButton: true, text: '<script type="importmap">{ "imports": { "@openav/core": "./x.js" } }</script>' }).params.kind, 'import_map');
  assert.deepEqual(click({ copyButton: true, text: 'node serve.js' }).params.kind, 'code');
  assert.deepEqual(click({ copyButton: true, copy: 'other', text: 'a report' }).params.kind, 'other', 'the generator\'s word wins');
  assert.deepEqual(click({ copyButton: true, text: '' }).params.kind, 'other');
  assert.ok(!JSON.stringify(click({ copyButton: true, text: 'secret words' })).includes('secret'), 'the copied text is not in the event');

  // downloads, next steps, the language switch
  assert.deepEqual(click({ event: 'export_download', format: 'qlc', id: 'akai-lpd8', href: 'https://openaudiovisual.com/controllers/akai-lpd8/akai-lpd8.qxi' }),
    { name: 'oav_export_download', params: { format: 'qlc', controller: 'akai-lpd8', page_type: 'controller' } });
  assert.equal(click({ event: 'export_download', format: 'exe' }).params.format, 'other', 'an unknown format is "other"');
  assert.equal(click({ event: 'export_download', format: 'json' }).params.controller, 'akai-lpd8', 'the page\'s own controller when the link names none');
  assert.deepEqual(click({ event: 'next_step', to: 'p5', href: 'https://openaudiovisual.com/p5/' }), { name: 'oav_next_step', params: { from: 'controller', to: 'p5' } });
  assert.equal(click({ event: 'next_step', to: 'somewhere' }).params.to, 'other');
  assert.equal(click({ event: 'next_step' }), null, 'a next step names where it goes');
  assert.deepEqual(click({ event: 'lang_switch', lang: 'zh' }), { name: 'oav_lang_switch', params: { page_type: 'controller', to: 'zh' } });
  assert.equal(click({ event: 'lang_switch', lang: 'en', current: true }), null, 'the language you are in is not a switch');

  // outbound: the host only, and what kind of place it is
  assert.deepEqual(click({ href: 'https://github.com/frank890417/open-audiovisual/issues/new?title=Wrong%20data' }),
    { name: 'oav_outbound', params: { kind: 'github', host: 'github.com', page_type: 'controller' } });
  assert.deepEqual(click({ href: 'https://cdn.inmusicbrands.com/akai/LPD8/LPD8%20mk2.pdf', link: 'vendor' }).params, { kind: 'vendor', host: 'cdn.inmusicbrands.com', page_type: 'controller' });
  assert.equal(click({ href: 'https://openprocessing.org/sketch/create' }).params.kind, 'openprocessing');
  assert.equal(click({ href: 'https://lab.cheyuwu.com/', link: 'work' }).params.kind, 'work');
  assert.equal(click({ href: 'https://example.org/course', link: 'course' }).params.kind, 'course');
  assert.equal(click({ href: 'https://example.org/' }).params.kind, 'other');
  assert.equal(click({ href: 'https://openaudiovisual.com/docs/' }), null, 'a page of this site is not outbound');
  assert.equal(click({ href: 'https://webtoe.openaudiovisual.com/' }), null, 'nor a subdomain of it');
  assert.equal(T.fromClick({ pageType: 'home', here: '127.0.0.1', href: 'http://127.0.0.1:8080/docs/' }), null, 'nor the host the page is on');
  assert.equal(click({ href: 'mailto:someone@example.org' }), null, 'only http(s) links');
  assert.equal(click({ event: 'next_step', to: 'docs', href: 'https://example.org/' }).name, 'oav_next_step', 'data-oav-event wins over the outbound guess');
  assert.equal(click({}), null, 'a click on nothing in particular is nothing');

  // the once-per-page-view ones (the page keeps the "once"; the mapping says what each one is)
  assert.deepEqual(T.ONCE.sort(), ['controller_play', 'example_start', 'search']);
  assert.deepEqual(T.fromControl({ hooked: true, source: 'ui', profile: 'akai-lpd8', pageType: 'controller' }), { name: 'oav_controller_play', params: { controller: 'akai-lpd8', page_type: 'controller' } });
  assert.equal(T.fromControl({ hooked: true, source: 'hardware', profile: 'akai-lpd8', pageType: 'controller' }), null, 'a real controller is not the on-screen one');
  assert.equal(T.fromControl({ hooked: false, source: 'ui', profile: 'akai-lpd8', pageType: 'verify' }), null, 'only a controller the page marked');
  assert.deepEqual(T.fromInput({ search: true, pageType: 'reference' }), { name: 'oav_search', params: { page_type: 'reference' } });
  assert.equal(T.fromInput({ search: false, pageType: 'reference' }), null);
  assert.deepEqual(T.fromInteract({ pageType: 'example', pageId: '09-midi-controllers' }), { name: 'oav_example_start', params: { example: '09-midi-controllers' } });
  assert.equal(T.fromInteract({ pageType: 'example', pageId: '09-midi-controllers', inGuide: true }), null, 'the guide card is not the example');
  assert.equal(T.fromInteract({ pageType: 'docs', pageId: '' }), null);
  assert.deepEqual(T.fromNativeCopy({ inCode: true, text: loader, pageType: 'cheatsheet' }), { name: 'oav_copy', params: { kind: 'loader', page_type: 'cheatsheet' } });
  assert.equal(T.fromNativeCopy({ inCode: false, text: 'a sentence', pageType: 'docs' }), null, 'copying prose is not counted');
});

test('track: no param can carry an address, a query string or a typed sentence', () => {
  const nasty = [
    'https://example.org/a/b?q=secret&utm_source=x#frag', 'akai-lpd8?utm=1', 'p5?x=1&y=2', '../../etc/passwd', 'a b c d e f g h i j k l m n o p q r s t u v w x y z',
    '<script>alert(1)</script>', 'é漢字😀', '  ', 'x'.repeat(500), 'mailto:me@example.org', 'javascript:alert(1)', 'data:text/html,hi', '?', '=', '&', '%3F', null, undefined, 42, {},
  ];
  const hrefs = ['https://github.com/frank890417/open-audiovisual/issues/new?title=Wrong%20data%20for%20LPD8', 'https://user:pass@evil.example:8443/p?token=abc', 'http://xn--n3h.example/?a=1',
    'https://example.org/?q=' + encodeURIComponent('what someone typed'), 'not a url', '', '//example.org/?a=b'];
  let n = 0;
  const check = (ev, where) => {
    if (!ev) return;
    n++;
    assert.ok(NAMES.includes(ev.name), `${where}: ${ev.name} is a listed event`);
    assert.ok(Object.keys(ev.params).length <= 3, `${where}: at most three params`);
    for (const [k, v] of Object.entries(ev.params)) {
      assert.ok(T.SPEC[ev.name.slice(4)].includes(k), `${where}: ${k} is a param of ${ev.name}`);
      assert.match(v, TOKEN, `${where}: ${k}=${JSON.stringify(v)} is a short token`);
      assert.ok(!/[?=&/:#%@\s]/.test(v), `${where}: ${k}=${v} cannot hold a query string or an address`);
    }
  };
  for (const x of nasty) for (const pageType of ['controller', x]) {
    const base = { pageType, pageId: x, here: 'openaudiovisual.com' };
    for (const href of [...hrefs, x]) {
      for (const d of [
        { copyButton: true, copy: x, text: x }, { event: 'export_download', format: x, id: x }, { event: 'next_step', to: x }, { event: 'lang_switch', lang: x },
        { event: x, href, link: x }, { href, link: x }, { href },
      ]) check(T.fromClick({ ...base, ...d }), `click ${JSON.stringify(d).slice(0, 80)}`);
    }
    check(T.fromControl({ hooked: true, source: 'ui', profile: x, pageType }), 'control');
    check(T.fromInput({ search: true, pageType, value: x }), 'search');
    check(T.fromInteract({ pageType: 'example', pageId: x }), 'example');
    check(T.fromNativeCopy({ inCode: true, text: x, pageType }), 'copy');
  }
  for (const href of hrefs) {
    const ev = T.fromClick({ pageType: 'home', here: 'openaudiovisual.com', href });
    if (ev) assert.equal(ev.params.host, T.hostOf(href), `${href}: the host and nothing else`);
  }
  assert.ok(n > 1000, `${n} events checked`);
  assert.equal(T.clean('Akai-LPD8?x=1'), 'akai-lpd8x1');
  assert.equal(T.hostOf('https://user:pass@evil.example:8443/p?token=abc'), 'evil.example');
});

// ---------------------------------------------------------------------------- nothing without gtag
function fakePage({ gtag } = {}) {
  const listeners = [], calls = [];
  const target = () => ({ addEventListener: (type, fn, capture) => listeners.push({ type, capture }) });
  const document = { ...target(), querySelector: () => ({ getAttribute: (k) => (k === 'content' ? 'example' : k === 'data-oav-id' ? '01-hello-particles' : null) }) };
  const window = { ...target(), document };
  if (gtag) window.gtag = (...a) => calls.push(a);
  vm.runInNewContext(SRC, { window, document, location: { hostname: 'openaudiovisual.com' }, URL });
  return { listeners, calls };
}

test('track: without window.gtag it does nothing at all; with it, it listens on the capture phase and sends nothing by itself', () => {
  const off = fakePage();
  assert.deepEqual(off.listeners, [], 'no gtag (localhost, a fork, an embed): not one listener');
  const on = fakePage({ gtag: true });
  assert.deepEqual(on.listeners.map((l) => l.type).sort(), ['auxclick', 'click', 'control', 'copy', 'input', 'keydown', 'pointerdown']);
  assert.ok(on.listeners.every((l) => l.capture === true), 'capture phase: a canvas or a shadow root cannot hide the event');
  assert.deepEqual(on.calls, [], 'loading the page sends nothing (GA counts the page view itself)');
  assert.doesNotThrow(() => vm.runInNewContext(SRC, {}), 'no window at all: no error');
});

test('track: the page types are one list, and a page without one does not build', async () => {
  const { PAGE_TYPES, headBasics, pageCtx } = await import('../tools/site/chrome.mjs');
  const en = (await import('../tools/home/en.mjs')).default;
  assert.deepEqual(T.PAGE_TYPES, PAGE_TYPES, 'assets/track.js and tools/site/chrome.mjs list the same page types');
  assert.throws(() => headBasics(en, pageCtx('docs', 'en'), { title: 'x', description: 'y' }), /pageType/);
  assert.throws(() => headBasics(en, pageCtx('docs', 'en'), { title: 'x', description: 'y', pageType: 'blog' }), /pageType/);
  assert.match(headBasics(en, pageCtx('docs', 'en'), { title: 'x', description: 'y', pageType: 'docs' }), /<script defer src="\.\.\/assets\/track\.js"><\/script>/);
});

// ---------------------------------------------------------------------------- every page
async function sitePages() {
  const { registry, fileOf } = await import('../tools/site/pages.mjs');
  const TYPE = { home: 'home', docs: 'docs', reference: 'reference', cheatsheet: 'cheatsheet', controllers: 'controllers_index', 'controllers/verify': 'verify', webtoe: 'webtoe', check: 'check', made: 'made_with', examples: 'examples_index', p5: 'p5', changelog: 'changelog' };
  const out = [];
  for (const e of registry()) {
    const type = TYPE[e.id] || (e.group === 'controllers' ? 'controller' : e.group === 'examples' ? 'example' : e.group === 'fixtures' ? 'fixture' : e.group === 'device-pages' ? 'device' : e.id === 'devices' ? 'devices_index' : null);
    assert.ok(type, `${e.id}: a page type for it in this test`);
    const id = type === 'controller' || type === 'example' || type === 'fixture' || type === 'device' ? e.id.slice(e.id.indexOf('/') + 1) : '';
    for (const lang of e.langs) out.push({ rel: fileOf(e, lang), type, id });
  }
  out.push({ rel: '404.html', type: 'not_found', id: '' });
  return out;
}

test('track: every page of the site says what kind of page it is and loads assets/track.js exactly once', async () => {
  const pages = await sitePages();
  const types = new Set();
  for (const { rel, type, id } of pages) {
    const s = read(rel);
    const metas = [...s.matchAll(/<meta name="oav-page-type" content="([^"]*)"(?: data-oav-id="([^"]*)")?>/g)];
    assert.equal(metas.length, 1, `${rel}: one <meta name="oav-page-type">`);
    assert.equal(metas[0][1], type, `${rel}: page type`);
    assert.equal(metas[0][2] || '', id, `${rel}: page id`);
    const scripts = [...s.matchAll(/<script\b[^>]*\bsrc="[^"]*assets\/track\.js(?:\?v=[\w.+-]+)?"[^>]*><\/script>/g)];
    assert.equal(scripts.length, 1, `${rel}: assets/track.js once`);
    assert.match(scripts[0][0], /^<script defer src=/, `${rel}: loaded with defer`);
    const src = scripts[0][0].match(/src="([^"?]+)/)[1];
    if (!src.startsWith('/')) assert.ok(exists(path.join(path.dirname(rel), src)), `${rel}: ${src} is the file`);
    types.add(type);
  }
  const { PAGE_TYPES } = await import('../tools/site/chrome.mjs');
  assert.deepEqual([...types].sort(), [...PAGE_TYPES].sort(), 'every page type is in use');
});

test('track: the hooks the generators write are ones the script reads', async () => {
  const pages = await sitePages();
  const seen = { event: new Set(), to: new Set(), format: new Set(), link: new Set(), copy: new Set() };
  const allowed = {
    event: new Set(['lang_switch', 'controller_play', 'export_download', 'next_step']),
    to: new Set(T.NEXT_TO), format: new Set(T.FORMATS), link: new Set(T.OUT_KINDS), copy: new Set(T.COPY_KINDS),
  };
  for (const { rel } of pages) {
    const s = read(rel);
    for (const k of Object.keys(seen)) for (const m of s.matchAll(new RegExp(`data-oav-${k}="([^"]*)"`, 'g'))) {
      seen[k].add(m[1]);
      assert.ok(allowed[k].has(m[1]), `${rel}: data-oav-${k}="${m[1]}" is not a value assets/track.js knows`);
    }
    for (const m of s.matchAll(/<a\b[^>]*data-oav-event="next_step"[^>]*>/g)) assert.match(m[0], /data-oav-to="/, `${rel}: a next step says where it goes: ${m[0]}`);
  }
  for (const v of ['lang_switch', 'controller_play', 'export_download']) assert.ok(seen.event.has(v), `some page carries data-oav-event="${v}"`);
  for (const v of ['qlc', 'mixxx', 'json']) assert.ok(seen.format.has(v), `an export link for ${v}`);
  for (const v of ['vendor', 'work']) assert.ok(seen.link.has(v), `a link marked ${v}`);
  const lpd8 = read('controllers/akai-lpd8/index.html');
  assert.match(lpd8, /<oav-controller id="d-ctl" profile="akai-lpd8"[^>]*data-oav-event="controller_play"/, 'the device page\'s controller is counted');
  assert.doesNotMatch(read('controllers/verify/index.html'), /data-oav-event="controller_play"/, 'the verification page\'s controller is not (it checks hardware)');
});

// ---------------------------------------------------------------------------- the framework stays quiet
test('track: p5/oav-p5.js, p5/examples, packages/ and embed/ never load the tracker or send its events', () => {
  const files = [];
  const walk = (rel) => {
    const abs = path.join(ROOT, rel);
    if (fs.statSync(abs).isFile()) { files.push(rel); return; }
    for (const e of fs.readdirSync(abs, { withFileTypes: true })) if (e.name !== 'node_modules' && !e.name.startsWith('.')) walk(`${rel}/${e.name}`);
  };
  for (const rel of ['p5/oav-p5.js', 'p5/examples', 'packages', 'embed']) walk(rel);
  const text = files.filter((f) => /\.(js|mjs|cjs|html|json|md)$/.test(f));
  assert.ok(text.length > 100, `${text.length} files read`);
  // what is there today: the embed telemetry (packages/midi/telemetry.js, its README) names gtag to say it does not load it
  const GTAG_OK = new Set(['packages/midi/telemetry.js', 'packages/midi/README.md']);
  for (const f of text) {
    const s = read(f);
    assert.ok(!s.includes('track.js'), `${f}: mentions track.js`);
    assert.ok(!/data-oav-(event|to|format|link|copy)\b|oav-page-type/.test(s), `${f}: carries a site tracking hook`);
    for (const name of NAMES) assert.ok(!s.includes(name), `${f}: sends or names ${name}`);
    assert.ok(!/\bgtag\s*\(/.test(s), `${f}: calls gtag()`);
    if (/gtag/.test(s)) assert.ok(GTAG_OK.has(f), `${f}: mentions gtag (only the telemetry files may, to say they never load it)`);
  }
});
