// The device collection on the site (tools/build-devices.mjs): /devices/, /fixtures/<id>/, /devices/<id>/, in both languages.
// Reads the committed files, so it also catches "fixture added, generator not rerun". What must hold: every registered page
// exists with its title, description, canonical, hreflang and JSON-LD; the hub lists every device exactly once and links each
// to the one page it has (a controller to its unchanged /controllers/<id>/); a fixture page's channel tables are its file's; the
// code on a fixture or a device page runs against the real packages and prints what the page says; a device below two of
// "something to try, code, a file" has no page; the controllers' urls did not move.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { collection, ownPages, offers, PAGE_MIN, registerEntries } from '../tools/devices/sources.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SITE = 'https://openaudiovisual.com/';
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const exists = (rel) => fs.existsSync(path.join(ROOT, rel));
const LIST = collection();
const OWN = ownPages(LIST);
const FIXTURES = OWN.filter((d) => d.row.kind === 'dmx-fixture');
const DEVICES = OWN.filter((d) => d.row.kind !== 'dmx-fixture');
const file = (p, lang) => `${lang === 'zh' ? 'zh/' : ''}${p}index.html`;
const url = (p, lang) => SITE + (lang === 'zh' ? 'zh/' : '') + p;
const ld = (s) => JSON.parse(s.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1])['@graph'];
const meta = (s, re) => (s.match(re) || [])[1];
const unhtml = (x) => x.replace(/<[^>]+>/g, '').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&');
const ZH_BAD = /[；]|——/;

// ------------------------------------------------------------------ what gets a page
test('the rule: a device gets a page of its own only when it offers two of the three; the Brother QL-810W stays a row', () => {
  assert.equal(PAGE_MIN, 2);
  for (const d of LIST) {
    const o = offers(d.row, d.record);
    assert.equal(!!d.page, o.count >= 2, `${d.row.id}: ${JSON.stringify(o)} → ${d.page}`);
  }
  const ql = LIST.find((d) => d.row.id === 'brother-ql-810w');
  assert.equal(ql.page, null, 'no OAV code, nothing to try: only its record');
  assert.ok(FIXTURES.length >= 40 && DEVICES.length >= 20, `${FIXTURES.length} fixture pages, ${DEVICES.length} device pages`);
  assert.ok(LIST.filter((d) => d.row.kind === 'midi-controller').every((d) => d.page === `controllers/${d.row.id}/`), 'a controller keeps its /controllers/<id>/ page');
  // the register is the same list
  const reg = registerEntries(LIST);
  assert.deepEqual(reg.map((e) => e.path), ['devices/', ...FIXTURES.map((d) => d.page), ...DEVICES.map((d) => d.page)]);
});

test('no controller url moved or is duplicated: every url of the sitemap before the collection is still there, and no controller has a second page', () => {
  const before = read('tests/fixtures/sitemap-controller-urls.txt').trim().split('\n');
  assert.ok(before.length >= 100, `${before.length} controller urls before`);
  const sm = read('sitemap.xml');
  const locs = new Set([...sm.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]));
  for (const u of before) {
    assert.ok(locs.has(u), `${u} is still in the sitemap`);
    assert.ok(exists(u.slice(SITE.length) + 'index.html'), `${u} still has its page`);
  }
  for (const d of LIST.filter((x) => x.row.kind === 'midi-controller')) {
    for (const p of [`fixtures/${d.row.id}/`, `devices/${d.row.id}/`]) assert.ok(!exists(p + 'index.html') && !locs.has(SITE + p), `${d.row.id}: no second page at /${p}`);
  }
});

// ------------------------------------------------------------------ every page: the head
test('every fixture and device page and the hub exist in both languages with title, description, canonical, hreflang and JSON-LD', () => {
  const titles = new Set(), descs = new Set();
  for (const p of ['devices/', ...OWN.map((d) => d.page)]) for (const lang of ['en', 'zh']) {
    const rel = file(p, lang);
    assert.ok(exists(rel), `${rel} is missing (node tools/build-devices.mjs)`);
    const s = read(rel);
    const title = meta(s, /<title>([^<]*)<\/title>/), desc = meta(s, /<meta name="description" content="([^"]*)"/);
    assert.ok(title && title.length <= 90 && /open-audiovisual$/.test(title), `${rel}: title "${title}"`);
    assert.ok(desc && desc.length >= 50 && desc.length <= (lang === 'zh' ? 120 : 165), `${rel}: description ${desc && desc.length}`);
    assert.ok(!titles.has(title), `${rel}: title unique`); titles.add(title);
    assert.ok(!descs.has(desc), `${rel}: description unique`); descs.add(desc);
    if (lang === 'zh') assert.ok(!ZH_BAD.test(title) && !ZH_BAD.test(desc), `${rel}: no ； or —— in the title and description`);
    assert.match(s, new RegExp(`<html lang="${lang === 'zh' ? 'zh-Hant-TW' : 'en'}">`));
    assert.ok(s.includes(`<link rel="canonical" href="${url(p, lang)}">`), `${rel}: canonical`);
    for (const [hl, u] of [['en', url(p, 'en')], ['zh-Hant', url(p, 'zh')], ['x-default', url(p, 'en')]]) assert.ok(s.includes(`<link rel="alternate" hreflang="${hl}" href="${u}">`), `${rel}: hreflang ${hl}`);
    const g = ld(s), by = (t) => g.find((x) => x['@type'] === t);
    assert.ok(by('BreadcrumbList'), `${rel}: BreadcrumbList`);
    assert.equal(g.find((x) => x['@id'] === url(p, lang) + '#webpage').url, url(p, lang));
    const pt = p === 'devices/' ? 'devices_index' : p.startsWith('fixtures/') ? 'fixture' : 'device';
    assert.match(s, new RegExp(`<meta name="oav-page-type" content="${pt}"`), `${rel}: page type ${pt}`);
    if (p !== 'devices/') {
      const bc = by('BreadcrumbList');
      assert.deepEqual(bc.itemListElement.map((x) => x.item), [SITE + (lang === 'zh' ? 'zh/' : ''), url('devices/', lang), url(p, lang)]);
      const ds = g.find((x) => x['@id'] === url(p, lang) + '#dataset');
      assert.ok(ds && ds.distribution[0].encodingFormat === 'application/json', `${rel}: a Dataset with its JSON`);
      const about = g.find((x) => x['@id'] === url(p, lang) + '#product');
      for (const bad of ['offers', 'review', 'aggregateRating']) assert.ok(!(bad in about), `${rel}: no invented ${bad}`);
      // the last section of the main content is the next step, every link of it counted
      const main = s.slice(s.indexOf('<main'), s.indexOf('</main>'));
      const at = main.indexOf('<section class="sec next-step" id="next-step"');
      assert.ok(at > 0 && main.lastIndexOf('<section') === at, `${rel}: the next step is the last section`);
      assert.ok([...main.slice(at).matchAll(/<a\b[^>]*data-oav-event="next_step" data-oav-to="(docs|example)"/g)].length >= 2, `${rel}: next-step links`);
    }
  }
  // the sitemap lists them, hreflang-linked
  const sm = read('sitemap.xml');
  for (const d of OWN) assert.ok(sm.includes(`<loc>${url(d.page, 'en')}</loc>`) && sm.includes(`<loc>${url(d.page, 'zh')}</loc>`), `sitemap: ${d.page}`);
});

// ------------------------------------------------------------------ the hub
test('the hub lists every device exactly once, grouped by kind, each linked to its one page or to its record', () => {
  for (const lang of ['en', 'zh']) {
    const s = read(file('devices/', lang));
    const rows = [...s.matchAll(/<li class="dev" data-id="([^"]+)" data-kind="([^"]+)"[^>]*>([\s\S]*?)<\/li>/g)];
    assert.equal(rows.length, LIST.length, `${lang}: one row per device`);
    assert.equal(new Set(rows.map((m) => m[1])).size, rows.length, `${lang}: no device twice`);
    const pre = lang === 'zh' ? '../../zh/' : '../';
    for (const d of LIST) {
      const m = rows.find((x) => x[1] === d.row.id);
      assert.ok(m, `${lang}: ${d.row.id} is listed`);
      assert.equal(m[2], d.row.kind);
      assert.ok(s.includes(`id="kind-${d.row.kind}"`), `${lang}: a group for ${d.row.kind}`);
      if (d.page) assert.ok(m[3].includes(`<a class="dev-name" href="${pre}${d.page}">`), `${lang}: ${d.row.id} links ${d.page}`);
      else assert.ok(m[3].includes(`href="${lang === 'zh' ? '../../' : '../'}packages/${d.file}"`) && !m[3].includes('class="dev-name" href'), `${lang}: ${d.row.id} has no page: its record`);
    }
    assert.match(s, /<input type="search" id="dev-q"/, 'a search box (assets/track.js counts its first input as oav_search)');
    assert.ok(!/<script[^>]*src="[^"]*catalog\.js/.test(s), 'the hub filters the rows on the page, no catalog to load');
    const itemList = ld(s).find((x) => x['@type'] === 'ItemList');
    assert.equal(itemList.numberOfItems, LIST.filter((d) => d.page).length);
  }
});

// ------------------------------------------------------------------ fixture pages
test('a fixture page\'s channel tables are its file: every mode, every channel in order, its default', () => {
  for (const d of FIXTURES) for (const lang of ['en', 'zh']) {
    const s = read(file(d.page, lang)), fx = d.data;
    for (const m of fx.modes) {
      const blk = s.match(new RegExp(`<div class="mode-table" id="mode-${m.id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}">([\\s\\S]*?)</table>`));
      assert.ok(blk, `${d.page} ${lang}: a table for mode ${m.id}`);
      const rows = [...blk[1].matchAll(/<tr data-key="([^"]+)"><td class="n">(\d+)<\/td>[\s\S]*?<td class="n">(\d+)<\/td>/g)];
      assert.deepEqual(rows.map((r) => r[1]), m.channels, `${d.page} ${lang} ${m.id}: the channels in order`);
      assert.deepEqual(rows.map((r) => Number(r[2])), m.channels.map((_, i) => i + 1));
      assert.deepEqual(rows.map((r) => Number(r[3])), m.channels.map((k) => fx.channels[k].default ?? 0), `${d.page} ${m.id}: defaults`);
    }
    // the three things: something to try, code, a file
    assert.match(s, /<div class="vfx js-only" id="vfx">/, `${d.page}: the virtual fixture`);
    assert.match(s, /<pre id="snip-fixture">/, `${d.page}: the code`);
    assert.ok(s.includes(`data-oav-event="export_download" data-oav-format="json" data-oav-id="${fx.id}"`), `${d.page}: the file`);
    const data = JSON.parse(s.match(/<script type="application\/json" id="fx-data">([\s\S]*?)<\/script>/)[1]);
    assert.deepEqual(data.profile, fx, `${d.page}: the virtual fixture drives the file itself`);
    // credit and licence on an imported fixture
    if (fx.origin) {
      const m = /^fixtures\/([a-z0-9-]+)\/([a-z0-9-]+)\.json$/.exec(fx.origin.file);
      assert.ok(s.includes(`https://open-fixture-library.org/${m[1]}/${m[2]}`), `${d.page}: links its OFL page`);
      if (lang === 'en') assert.ok(s.includes('Channel data from Open Fixture Library (MIT)'), `${d.page}: the credit`);
      else assert.ok(s.includes('通道資料來自 Open Fixture Library（MIT）'), `${d.page}: the credit (zh)`);
    }
  }
});

/** Run snippets from the pages in one Node process, the site's package urls swapped for the local files; what each printed. */
function runSnippets(list) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'oav-snippets-'));
  const pkg = pathToFileURL(path.join(ROOT, 'packages') + '/').href;
  const files = list.map(({ id, code }, i) => {
    const f = path.join(dir, `${i}-${id}.mjs`);
    fs.writeFileSync(f, code.replaceAll(`${SITE}packages/`, pkg));
    return { id, url: pathToFileURL(f).href };
  });
  const harness = `
    const el = () => ({ append() {}, appendChild(x) { return x; }, addEventListener() {}, set onclick(f) { this._f = f; }, style: {} });
    globalThis.document = { body: el(), createElement: el };
    const out = {};
    const log = console.log;
    for (const { id, url } of ${JSON.stringify(files)}) {
      const lines = [];
      console.log = (...a) => lines.push(a.map(String).join(' '));
      try { await import(url); } catch (e) { lines.push('THREW ' + e.message); }
      out[id] = lines;
    }
    console.log = log;
    console.log(JSON.stringify(out));`;
  const r = spawnSync(process.execPath, ['--input-type=module', '-e', harness], { encoding: 'utf8', cwd: dir });
  fs.rmSync(dir, { recursive: true, force: true });
  assert.equal(r.status, 0, r.stderr);
  return JSON.parse(r.stdout.trim().split('\n').pop());
}
const snippetOf = (s, id) => unhtml(s.match(new RegExp(`<pre id="${id}"><code>([\\s\\S]*?)</code></pre>`))[1]);
const claimOf = (code) => (code.match(/^\/\/ → (.*)$/m) || [])[1];

test('the code on every fixture page runs against the real packages and prints the bytes the page says', () => {
  const list = FIXTURES.map((d) => ({ id: d.row.id, code: snippetOf(read(file(d.page, 'en')), 'snip-fixture') }));
  const out = runSnippets(list);
  for (const { id, code } of list) {
    assert.match(code, new RegExp(`await device\\('${id}'\\)`), `${id}: device('${id}')`);
    assert.match(code, /^import \{ device \} from 'https:\/\/openaudiovisual\.com\/packages\/devices\/index\.js';$/m, `${id}: loads the packages from the site`);
    const claim = claimOf(code);
    assert.ok(claim, `${id}: says what it prints`);
    assert.deepEqual(out[id], [claim], `${id}: prints ${claim}`);
    // and the list under the code says the same bytes
    const s = read(file(`fixtures/${id}/`, 'en'));
    const listed = [...s.match(/<ol class="vfx-print">([\s\S]*?)<\/ol>/)[1].matchAll(/<b>(\d+)<\/b>/g)].map((m) => m[1]).join(' ');
    assert.equal(listed, claim, `${id}: the byte list under the code`);
  }
  // the zh page carries the same program
  for (const d of FIXTURES.slice(0, 5)) assert.equal(snippetOf(read(file(d.page, 'zh')), 'snip-fixture'), list.find((x) => x.id === d.row.id).code);
  // one worked by hand: a SlimPAR T12 BT in 7ch at full orange: red green blue strobe autoProgram autoProgramSpeed dimmer
  assert.equal(out['chauvet-dj-slimpar-t12-bt'][0], '255 128 0 0 0 0 255');
});

// ------------------------------------------------------------------ device pages
test('a device page: facts with their sources, setup and problems from the record; the code runs and prints what it says; its files', async () => {
  const { SINKS } = await import('../packages/out/bridge/sinks/index.js');
  const list = [];
  for (const d of DEVICES) for (const lang of ['en', 'zh']) {
    const s = read(file(d.page, lang)), rec = d.record;
    const code = snippetOf(s, 'snip-device');
    if (lang === 'en') list.push({ id: d.row.id, code });
    assert.match(code, new RegExp(`await device\\('${d.row.id}'\\)`), `${d.page}: device('${d.row.id}')`);
    if (d.row.from === 'hw-part') {
      for (const k of Object.keys(d.data.pins)) assert.ok(s.includes(`<th scope="row"><code>${k.replace(/&/g, '&amp;')}</code></th>`), `${d.page}: pin ${k}`);
      for (const src of d.data.sources) assert.ok(s.includes(`href="${src.url.replace(/&/g, '&amp;')}"`), `${d.page}: datasheet ${src.title}`);
      assert.ok(s.includes('#packages-openav-hw'), `${d.page}: the hw docs`);
      assert.ok(exists(`${d.page}${d.row.id}.json`), `${d.page}: its JSON file`);
      const pj = JSON.parse(read(`${d.page}${d.row.id}.json`));
      assert.deepEqual(pj.part, JSON.parse(JSON.stringify(d.data)), `${d.page}: the file is the library entry`);
    } else {
      for (const f of rec.data.facts) assert.ok(s.includes(`href="${rec.sources[f.source].url.replace(/&/g, '&amp;')}"`), `${d.page}: fact ${f.key} links its source`);
      for (const x of [...rec.setup, ...rec.problems]) assert.ok(unhtml(s).includes(x[lang]), `${d.page}: "${x[lang].slice(0, 40)}…"`);
      assert.ok(s.includes(`href="${lang === 'zh' ? '../../../' : '../../'}packages/${d.file}"`), `${d.page}: the record file`);
      if (rec.kind === 'camera' || rec.kind === 'audio-interface') {
        assert.match(s, /<div class="live js-only" id="live"/, `${d.page}: the live helper`);
        assert.match(s, /<button type="button" class="vf-btn" id="live-find">/, `${d.page}: behind a button`);
      }
    }
    if (exists(`${d.page}out.json`)) {
      const cfg = JSON.parse(read(`${d.page}out.json`));
      for (const ch of cfg.channels) assert.ok(SINKS[ch.sink], `${d.page}out.json: sink ${ch.sink} exists`);
      assert.ok(cfg.channels[0].sink === 'ddp' ? cfg.channels[0].host && cfg.channels[0].port === 4048 : cfg.channels[0].sink === 'enttec' && cfg.channels[0].path, `${d.page}out.json: the route says where`);
    }
  }
  assert.ok(exists('devices/wled/out.json') && exists('devices/enttec-dmx-usb-pro/out.json'), 'the bridge configs');
  const out = runSnippets(list);
  for (const { id, code } of list) assert.deepEqual(out[id], [claimOf(code)], `${id}: prints what it says`);
});

test('the live helper asks for nothing on load: device.js touches the media devices only inside its click handlers', () => {
  const src = read('assets/devices/device.js');
  const body = src.replace(/addEventListener\('click', async \(\) => \{[\s\S]*?\n {2}\}\);/g, '');
  const CALL = /getUserMedia\(|enumerateDevices\(\)|\.find\(\)|\.open\(\)|requestPort\(|requestMIDIAccess\(/;
  assert.ok(CALL.test(src), 'the handlers do call them');
  assert.ok(!CALL.test(body.replace(/\/\/.*$/gm, '')), 'nothing outside a click handler asks for a device');
  for (const f of ['assets/devices/hub.js', 'assets/devices/fixture.js', 'assets/devices/copy.js']) assert.ok(!CALL.test(read(f)), `${f}: no device access`);
});

// ------------------------------------------------------------------ strings and the generator
test('the string tables have one shape, and the Chinese has no ； or ——', async () => {
  const { shapeDiff } = await import('../tools/build-home.mjs');
  const en = (await import('../tools/devices/en.mjs')).default, zh = (await import('../tools/devices/zh.mjs')).default;
  assert.deepEqual(shapeDiff(en, zh), []);
  assert.ok(!ZH_BAD.test(read('tools/devices/zh.mjs')), 'tools/devices/zh.mjs');
  const facts = new Set(LIST.filter((d) => d.row.from === 'device-record').flatMap((d) => d.record.data.facts.map((f) => f.key)));
  for (const k of facts) assert.ok(en.device.factNames[k] && zh.device.factNames[k], `a name for the fact "${k}" in both tables`);
});

test('the deploy stamps the device pages\' module and stylesheet urls, as it does the controllers\' (tools/stamp-version.mjs)', () => {
  const stamp = read('tools/stamp-version.mjs');
  for (const x of ["'devices/index.html'", "'zh/devices/index.html'", "'devices', 'zh/devices', 'fixtures', 'zh/fixtures'"]) assert.ok(stamp.includes(x), `stamp-version covers ${x}`);
});

test('build-devices --check: the catalog, every page and file and the sitemap are what the generator writes', async () => {
  const { buildFiles, staleFiles } = await import('../tools/build-devices.mjs');
  assert.deepEqual(staleFiles(await buildFiles()), []);
});
