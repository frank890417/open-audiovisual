// /controllers/ (en) and /zh/controllers/ are static pages rendered from one template
// (tools/build-controllers.mjs) with every device fact read from packages/midi/profiles.
// These tests keep them honest: fresh, same shape, every profile present, links alive.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildPages, stalePages, PAGES } from '../tools/build-controllers.mjs';
import { shapeDiff } from '../tools/build-home.mjs';
import { catalog, placeSection } from '../tools/controllers/page.mjs';
import { ldNode } from './_ld.js';
import en from '../tools/controllers/en.mjs';
import zh from '../tools/controllers/zh.mjs';
import { PROFILES } from '../packages/midi/profiles/index.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const URLS = { en: 'https://openaudiovisual.com/controllers/', zh: 'https://openaudiovisual.com/zh/controllers/' };
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const html = { en: read(PAGES.en), zh: read(PAGES.zh) };
const all = (re, s) => [...s.matchAll(re)].map((m) => m[1]);
const body = (s) => s.slice(s.indexOf('<body'));
// pages another agent is building at the same time; their links are checked once the file exists
const PENDING = new Set(['docs/index.html', 'zh/docs/index.html']);

test('string tables have the same shape', () => { assert.deepEqual(shapeDiff(en, zh), []); });

test('committed pages are what the template renders (run node tools/build-controllers.mjs)', () => {
  assert.deepEqual(stalePages(buildPages()), []);
});

test('every registered profile has a card, an index row (the old #spec-<id> anchor) and a hero chip, all linking to its own page', () => {
  for (const lang of ['en', 'zh']) {
    const s = html[lang];
    for (const p of PROFILES) {
      assert.match(s, new RegExp(`<li class="card" id="card-${p.id}"`), `${lang}: card ${p.id}`);
      assert.match(s, new RegExp(`<tr id="spec-${p.id}"><th scope="row"><a href="${p.id}/">`), `${lang}: index row / #spec-${p.id} anchor`);
      assert.match(s, new RegExp(`class="chip" href="${p.id}/" data-profile="${p.id}"`), `${lang}: chip ${p.id}`);
      assert.match(s, new RegExp(`<h4 class="card-name"><a href="${p.id}/">`), `${lang}: card name link ${p.id}`);
      assert.match(s, new RegExp(`<a class="card-face-link" href="${p.id}/"`), `${lang}: card face link ${p.id}`);
    }
  }
});

test('numbers on the page come from the profiles (a few spot checks)', () => {
  const lpd8 = read('controllers/akai-lpd8/index.html');
  assert.match(lpd8, /K1 <code class="cid">k1<\/code><\/th>\s*<td>knob<\/td>\s*<td>CC<\/td>\s*<td class="n">1<\/td>\s*<td class="n">70<\/td>/);
  assert.match(lpd8, /Pad 1 <code class="cid">pad1<\/code><\/th>\s*<td>pad<\/td>\s*<td>Note · velocity<\/td>\s*<td class="n">10<\/td>\s*<td class="n">36 · C2<\/td>/);
  const { stats } = catalog();
  assert.equal(stats.devices, PROFILES.filter((p) => p.kind === 'device').length);
  assert.match(html.en, new RegExp(`<dd>${stats.controls}</dd>`));
});

test('both pages: same sections, same headings, same links one to one', () => {
  const ids = (s) => all(/<section[^>]*\sid="([^"]+)"/g, s);
  assert.deepEqual(ids(html.en), ['play', 'catalog', 'choose', 'specs', 'embed', 'model']);
  assert.deepEqual(ids(html.zh), ids(html.en));
  for (const lvl of [1, 2, 3, 4]) {
    const n = (s) => (body(s).match(new RegExp(`<h${lvl}[\\s>]`, 'g')) || []).length;
    assert.equal(n(html.zh), n(html.en), `h${lvl} count`);
  }
  assert.equal((html.en.match(/<h1[\s>]/g) || []).length, 1);
  const norm = (h, base) => new URL(h, base).href.replace(/\?v=[\w.-]+/, '').replace(/^(https?:\/\/[^/]+)\/zh(\/|$)/, '$1/');
  const links = (lang) => all(/<a\s[^>]*href="([^"]+)"/g, body(html[lang])).map((h) => norm(h.replace(/&amp;/g, '&'), URLS[lang]))
    .filter((h) => !/tobias-erichsen/.test(h));
  assert.deepEqual(links('zh'), links('en'));
});

test('language metadata: lang, canonical, hreflang trio, JSON-LD', () => {
  for (const [lang, want] of [['en', 'en'], ['zh', 'zh-Hant-TW']]) {
    const s = html[lang];
    assert.match(s, new RegExp(`<html lang="${want}">`));
    assert.match(s, new RegExp(`<link rel="canonical" href="${URLS[lang]}">`));
    for (const [hl, url] of [['en', URLS.en], ['zh-Hant', URLS.zh], ['x-default', URLS.en]])
      assert.match(s, new RegExp(`<link rel="alternate" hreflang="${hl}" href="${url}">`), `${lang} hreflang ${hl}`);
    const ds = ldNode(s, 'Dataset'), list = ldNode(s, 'ItemList');
    assert.equal(ds['@type'], 'Dataset'); assert.equal(ds.distribution.length, PROFILES.length);
    assert.equal(list['@type'], 'ItemList'); assert.equal(list.numberOfItems, PROFILES.length);
  }
});

test('every local link and asset exists, every #anchor has a target', () => {
  for (const [lang, rel] of Object.entries(PAGES)) {
    const s = html[lang];
    const dir = path.dirname(path.join(ROOT, rel));
    for (const ref of all(/\s(?:href|src)="([^"]+)"/g, s)) {
      if (/^(https?:|data:|mailto:)/.test(ref)) continue;
      if (ref.startsWith('#')) { assert.match(s, new RegExp(`id="${ref.slice(1)}"`), `${lang}: ${ref} has no target`); continue; }
      const clean = ref.replace(/&amp;/g, '&').split(/[?#]/)[0];
      let f = path.join(dir, clean);
      if (clean.endsWith('/')) f = path.join(f, 'index.html');
      const r = path.relative(ROOT, f);
      if (PENDING.has(r) && !fs.existsSync(f)) continue;
      assert.ok(fs.existsSync(f), `${lang}: ${ref} → ${r} missing`);
    }
  }
});

test('no-JS readers get everything: the hero has a static faceplate, every card has a link, the index lists every profile', () => {
  assert.match(html.en, /<oav-controller id="hero-ctl"[^>]*><svg class="fp"/);
  assert.equal((html.en.match(/<tr id="spec-/g) || []).length, PROFILES.length);
});

test('old links keep working: #spec-<id> and ?profile=<id> are redirected to /controllers/<id>/ by a script in <head>', () => {
  for (const lang of ['en', 'zh']) {
    const head = html[lang].slice(0, html[lang].indexOf('</head>'));
    const m = head.match(/<script>\(function\(\)\{var ids=(\[[^\]]*\])[\s\S]*?location\.replace\([\s\S]*?<\/script>/);
    assert.ok(m, `${lang}: redirect script`);
    assert.deepEqual(JSON.parse(m[1]), PROFILES.map((p) => p.id));
    assert.match(m[0], /#spec-/); assert.match(m[0], /profile=/);
  }
});

test('static faceplate placement follows CSS grid flow and spans (nanoKONTROL2 strips)', () => {
  const nano = PROFILES.find((p) => p.id === 'korg-nanokontrol2');
  const pl = placeSection(nano.sections.find((s) => s.id === 'strips'));
  assert.equal(pl.size, 32);
  const f1 = pl.get('f1');
  assert.deepEqual([f1.cs, f1.rs, f1.row], [1, 3, 0]);
  const cells = new Set();
  for (const v of pl.values()) for (let a = 0; a < v.cs; a++) for (let b = 0; b < v.rs; b++) { const k = `${v.col + a},${v.row + b}`; assert.ok(!cells.has(k), 'no overlap ' + k); cells.add(k); }
});

test('the iframe embed page exists and loads its script', () => {
  const s = read('embed/controller/index.html');
  assert.match(s, /<oav-controller id="ctl"[^>]*>/);
  assert.match(s, /<script type="module" src="\.\/frame\.js/);
  assert.ok(fs.existsSync(path.join(ROOT, 'embed/controller/frame.js')));
});

// ------------------------------------------------------------------ "how to choose": the comparison table, the LED section, wishes, the no-Web-MIDI strip
const ISSUE_URL = 'https://github.com/frank890417/open-audiovisual/issues/new?template=controller-request.yml';
const physical = (c) => (c.type === 'keys' ? c.to - c.from + 1 : 1);
/** Independent of the generator: count a profile's controls straight from the JSON. */
const countsOf = (p) => {
  const n = { keys: 0, pad: 0, knob: 0, encoder: 0, fader: 0, button: 0 };
  for (const c of p.controls) {
    const k = c.type === 'keys' ? 'keys' : c.type;
    if (k in n) n[k] += physical(c);
  }
  return n;
};
const unverifiedOf = (p) => p.controls.filter((c) => c.verified === false).reduce((a, c) => a + physical(c), 0);
const rowOf = (s, id) => (s.match(new RegExp(`<tr id="cmp-${id}"[\\s\\S]*?</tr>`)) || [''])[0];
const cell = (row, col) => ((row.match(new RegExp(`<td[^>]*data-col="${col}"[^>]*>([\\s\\S]*?)</td>`)) || [])[1] || '').replace(/<[^>]+>/g, '').trim();

test('comparison table: one row per profile, every number is the one the profile file gives', () => {
  for (const lang of ['en', 'zh']) {
    const s = html[lang];
    assert.equal((s.match(/<tr id="cmp-/g) || []).length, PROFILES.length, `${lang}: rows`);
    for (const p of PROFILES) {
      const row = rowOf(s, p.id);
      assert.ok(row, `${lang}: row ${p.id}`);
      assert.match(row, new RegExp(`<a href="${p.id}/">`), `${lang}: ${p.id} row links to its page`);
      const n = countsOf(p);
      for (const col of Object.keys(n)) assert.equal(cell(row, col), n[col] ? String(n[col]) : '–', `${lang} ${p.id} ${col}`);
      const led = p.controls.some((c) => c.led);
      assert.match(row, new RegExp(`data-col="led" data-led="${led ? 'yes' : 'no'}"`), `${lang} ${p.id} led flag`);
      assert.equal(cell(row, 'unverified'), unverifiedOf(p) ? String(unverifiedOf(p)) : '–', `${lang} ${p.id} unverified`);
      assert.equal(cell(row, 'sources'), String((p.sources || []).length), `${lang} ${p.id} sources`);
    }
  }
});

test('comparison filters: each label carries the number of rows it keeps, computed from the profiles', () => {
  const want = {
    keys: PROFILES.filter((p) => countsOf(p).keys > 0).length,
    pad: PROFILES.filter((p) => countsOf(p).pad > 0).length,
    fader: PROFILES.filter((p) => countsOf(p).fader > 0).length,
    knob: PROFILES.filter((p) => countsOf(p).knob + countsOf(p).encoder > 0).length,
    led: PROFILES.filter((p) => p.controls.some((c) => c.led)).length,
    all: PROFILES.length,
  };
  assert.ok(want.keys > 0 && want.fader > 0 && want.pad > 0 && want.led === 5);
  for (const lang of ['en', 'zh']) {
    for (const [f, n] of Object.entries(want)) {
      const m = html[lang].match(new RegExp(`data-pick="${f}"[^>]*>[^<]*<b>(\\d+)</b>`));
      assert.ok(m, `${lang}: filter ${f}`);
      assert.equal(+m[1], n, `${lang}: filter ${f} count`);
    }
    // the rows carry what the script filters on, and it agrees with the label
    for (const f of ['keys', 'pad', 'fader', 'knob', 'led']) {
      const rows = [...html[lang].matchAll(/<tr id="cmp-[^"]+"[^>]*data-has="([^"]*)"/g)].filter((m) => m[1].split(' ').includes(f)).length;
      assert.equal(rows, want[f], `${lang}: data-has ${f}`);
    }
  }
});

test('the LED section names exactly the profiles that model LED feedback, and links them', () => {
  const withLed = PROFILES.filter((p) => p.controls.some((c) => c.led));
  for (const lang of ['en', 'zh']) {
    const sec = (html[lang].match(/<div class="led-note" id="led">[\s\S]*?<\/div>/) || [''])[0];
    assert.ok(sec, `${lang}: led section`);
    const linked = all(/<a href="([\w-]+)\/">/g, sec).sort();
    assert.deepEqual(linked, withLed.map((p) => p.id).sort(), `${lang}: LED models`);
  }
});

test('"no yours?" block on the gallery links the request template', () => {
  for (const lang of ['en', 'zh']) {
    const blk = (html[lang].match(/<div class="request" id="request">[\s\S]*?<\/div>/) || [''])[0];
    assert.ok(blk.includes(`href="${ISSUE_URL}"`), `${lang}: request link`);
  }
});

test('the issue form and the pull request template exist', () => {
  const y = read('.github/ISSUE_TEMPLATE/controller-request.yml');
  assert.match(y, /^name: /m); assert.match(y, /title: "MIDI controller request: "/);
  for (const k of ['maker-model', 'have-unit', 'can-test', 'manual']) assert.match(y, new RegExp(`id: ${k}\\b`), `field ${k}`);
  assert.match(y, /required: true/);
  const cfg = read('.github/ISSUE_TEMPLATE/config.yml');
  assert.match(cfg, /blank_issues_enabled: true/); assert.match(cfg, /contact_links:/);
  const pr = read('.github/pull_request_template.md');
  for (const w of ['source', 'verified', 'validateProfile', 'npm test']) assert.ok(pr.includes(w), `PR template mentions ${w}`);
  const c = read('CONTRIBUTING.md');
  for (const w of ['validateProfile', 'verified', 'controller-request.yml', 'AGENTS.md', 'profiles/index.js']) assert.ok(c.includes(w), `CONTRIBUTING mentions ${w}`);
});

test('no Web MIDI: a hidden strip, shown by a script that asks the browser (no user-agent sniffing)', () => {
  for (const lang of ['en', 'zh']) {
    const s = html[lang];
    assert.match(s, /<aside class="no-midi" id="no-midi" role="note" hidden>/);
    const scripts = all(/<script>([\s\S]*?)<\/script>/g, body(s)).filter((x) => x.includes('no-midi'));
    assert.equal(scripts.length, 1, `${lang}: one detector`);
    assert.match(scripts[0], /requestMIDIAccess/);
    assert.ok(!/userAgent|platform|navigator\.vendor/i.test(scripts[0]), 'no UA guessing');
  }
});
