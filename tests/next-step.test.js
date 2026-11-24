// The "next step" blocks at the end of a page's main content (tools/site/next-step.mjs and the generators that use it):
// the device pages hand over the controller in a p5.js sketch in the form the reference documents, the cheat sheet and the
// reference list the examples whose code uses each group of names, an example's guide card names the next example on
// its route, and the homepage ends with Made with and an empty course slot that leaves no trace.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const exists = (rel) => fs.existsSync(path.join(ROOT, rel));
const unhtml = (x) => x.replace(/<[^>]+>/g, '').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&');
const mainOf = (s) => s.slice(s.indexOf('<main'), s.indexOf('</main>'));
const linksTo = (s, to) => [...s.matchAll(new RegExp(`<a\\b[^>]*href="([^"]+)"[^>]*data-oav-event="next_step" data-oav-to="${to}"`, 'g'))].map((m) => m[1]);
const ZH_BAD = /[；]|——/;

// ---------------------------------------------------------------------------- device pages
test('next step, device pages: the controller in a p5.js sketch, the form the reference documents, then /p5/ and one example', async () => {
  const { catalog } = await import('../tools/controllers/page.mjs');
  const { LOADER } = await import('../tools/reference/model.mjs');
  const { nextExampleOf, NEXT_EXAMPLE } = await import('../tools/controllers/detail.mjs');
  const options = (await import('../p5/reference/options.mjs')).default;
  const documented = options['option:profile'].examples[0].code.split('\n')[0];
  assert.equal(documented, "window.OAV_P5 = { profile: 'akai-lpd8', panel: 'open' };", 'option:profile\'s example still starts the way the device pages copy it');
  const cat = catalog();
  let n = 0;
  for (const d of cat.pages) for (const lang of ['en', 'zh']) {
    const id = d.p.id, rel = `${lang === 'zh' ? 'zh/' : ''}controllers/${id}/index.html`, s = read(rel), main = mainOf(s);
    const at = main.indexOf('<section class="sec next-step" id="next-step"');
    assert.ok(at > 0, `${rel}: a next-step section`);
    assert.ok(main.lastIndexOf('<section') === at, `${rel}: it is the last section of the main content`);
    const code = unhtml(main.match(/<pre id="snip-next-p5"><code>([\s\S]*?)<\/code><\/pre>/)[1]);
    const [first, second] = code.split('\n');
    assert.equal(first, documented.replace("'akai-lpd8'", `'${id}'`), `${rel}: the documented form with this id`);
    assert.equal(second, LOADER, `${rel}: then the loader line`);
    assert.match(code, /function setup\(\) \{\n  createCanvas\(400, 300\);\n\}/, `${rel}: a sketch that runs as pasted`);
    assert.match(main, /<button type="button" class="copy" data-copy="snip-next-p5" data-oav-copy="loader">/, `${rel}: Copy counts as a loader copy`);
    assert.deepEqual(linksTo(main.slice(at), 'p5'), [lang === 'zh' ? '../../../zh/p5/' : '../../p5/'], `${rel}: the p5.js page`);
    const ex = linksTo(main.slice(at), 'example');
    assert.equal(ex.length, 1, `${rel}: one example`);
    assert.equal(ex[0], `../../${'../'.repeat(lang === 'zh' ? 1 : 0)}examples/${nextExampleOf(d).id}/`, `${rel}: the example the rule picks`);
    assert.ok(exists(`examples/${nextExampleOf(d).id}/index.html`));
    n++;
  }
  assert.ok(n >= 100, `${n} device pages`);
  // the rule, on devices whose make-up is known
  const pick = (id) => nextExampleOf(cat.pages.find((x) => x.p.id === id)).id;
  assert.equal(pick('generic-keys49'), NEXT_EXAMPLE.keys, 'keys → the note example');
  assert.equal(pick('arturia-minilab3'), NEXT_EXAMPLE.keys, 'keys win over pads and knobs');
  assert.equal(pick('novation-launchpad-mini-mk3'), NEXT_EXAMPLE.pads, 'pads → drums');
  assert.equal(pick('akai-lpd8'), NEXT_EXAMPLE.pads, 'as many pads as knobs → drums');
  assert.equal(pick('korg-nanokontrol2'), NEXT_EXAMPLE.controls, 'faders and knobs → the controllers example');
  assert.equal(NEXT_EXAMPLE.keys, '16-p5-sound'); assert.equal(NEXT_EXAMPLE.pads, '18-p5-drums'); assert.equal(NEXT_EXAMPLE.controls, '09-midi-controllers');
});

// ---------------------------------------------------------------------------- cheat sheet and reference
test('next step, cheat sheet and reference: the examples whose code uses each group of names, then Made with, after everything else', async () => {
  const labelsOf = (s) => Object.fromEntries([...s.matchAll(/<div><dt>([^<]*)<\/dt><dd>([\s\S]*?)<\/dd><\/div>/g)].map((m) => [m[1], [...m[2].matchAll(/examples\/(\d\d)-/g)].map((x) => x[1])]));
  for (const lang of ['en', 'zh']) {
    const pre = lang === 'zh' ? 'zh/' : '';
    const cs = read(`${pre}docs/cheatsheet/index.html`), ref = read(`${pre}docs/reference/index.html`);
    for (const [rel, s, before] of [[`${pre}docs/cheatsheet/index.html`, cs, '<p class="cs-foot">'], [`${pre}docs/reference/index.html`, ref, '<p class="ref-none" hidden>']]) {
      const main = mainOf(s), at = main.indexOf('<nav class="next-step"');
      assert.ok(at > main.indexOf(before), `${rel}: the block comes after the page's own content`);
      assert.equal(linksTo(main.slice(at), 'made_with').length, 1, `${rel}: Made with`);
      for (const href of linksTo(main.slice(at), 'example')) assert.ok(exists(path.join(path.dirname(rel), href, 'index.html')), `${rel}: ${href}`);
    }
    // the reference's block sits after <p class="ref-none">, which follows #ref-list: the search hides and reorders only what is inside
    const block = (x) => x.slice(x.indexOf('<nav class="next-step"'));
    const c = labelsOf(block(cs)), r = labelsOf(block(ref));
    const g = (o, en, zh) => o[lang === 'zh' ? zh : en] || [];
    // pinned pairs: if one of these goes, the scan in tools/examples/uses.mjs has drifted
    assert.ok(g(c, 'shout: the microphone', '喊：麥克風').includes('17'), `cheat sheet ${lang}: the microphone → 17`);
    assert.ok(g(c, 'hit: the drum machine', '敲：鼓機').includes('18'), `cheat sheet ${lang}: drums → 18`);
    assert.ok(g(c, 'make numbers nice to use', '讓數字好用').includes('22'), `cheat sheet ${lang}: lag → 22`);
    assert.ok(g(c, 'record and check', '錄影與體檢').includes('21'), `cheat sheet ${lang}: recording → 21`);
    assert.ok(g(c, 'play: keys and knobs', '彈：鍵盤與旋鈕').includes('16'), `cheat sheet ${lang}: keys → 16`);
    assert.ok(!g(c, 'record and check', '錄影與體檢').includes('17'), `cheat sheet ${lang}: 17 does not record`);
    assert.ok(g(r, 'Microphone and audio analysis', '麥克風與音訊分析').includes('17'), `reference ${lang}: mic → 17`);
    assert.ok(g(r, 'DMX lighting (@openav/dmx)', 'DMX 燈光（@openav/dmx）').includes('28'), `reference ${lang}: dmx → 28`);
    assert.ok(g(r, 'Leap Motion (@openav/leap)', 'Leap Motion（@openav/leap）').includes('12'), `reference ${lang}: leap → 12`);
    // a world asks createShow() for its inputs (modules: { hands, chord }) instead of importing them
    const pose = g(r, 'Body and hand pose (@openav/pose)', '身體與手部姿態（@openav/pose）');
    assert.ok(pose.includes('03') && pose.includes('27'), `reference ${lang}: pose → 03 and 27 (${pose})`);
    assert.ok(g(r, 'Chords (@openav/chord)', '和弦分析（@openav/chord）').includes('02'), `reference ${lang}: chords → 02`);
    for (const [k, v] of [...Object.entries(c), ...Object.entries(r)]) assert.ok(v.length >= 1 && v.length <= 4, `${lang}: ${k} has 1 to 4 examples`);
  }
  assert.match(read('assets/reference/cheatsheet.css'), /@media print \{[\s\S]*?\.next-step \{ display: none !important; \}/, 'the cheat sheet still prints on one A4');
  // /p5/ shows the same boxes, without the block
  assert.ok(!read('p5/index.html').includes('class="next-step"'), '/p5/ carries the boxes, not the block');
});

test('next step: the scan reads code, not comments, strings or another object\'s fields', async () => {
  const { identifiers, importsOf, examplesUsing } = await import('../tools/examples/uses.mjs');
  const ids = identifiers(`// micLevel in a comment\n/* beat */ const s = 'knob1 in a string', t = "fader1", u = \`pad1\`;\nfunction draw() { circle(0, 0, lag(micLevel)); x.note = 1; OAVp5.drums.edit(); }`);
  for (const n of ['micLevel', 'lag', 'draw', 'circle', 'OAVp5', 'OAVp5.drums', 'OAVp5.drums.edit']) assert.ok(ids.has(n), n);
  for (const n of ['beat', 'knob1', 'fader1', 'pad1', 'note', 'drums', 'edit']) assert.ok(!ids.has(n), `not ${n}`);
  assert.deepEqual([...importsOf("import { a } from '@openav/dmx';\nconst m = await import('@openav/pose');")].sort(), ['dmx', 'pose']);
  assert.deepEqual(examplesUsing({ packages: ['show'] }), [], 'a package most examples import points nowhere');
  const { showModulesOf, SHOW_MODULES } = await import('../tools/examples/uses.mjs');
  assert.deepEqual([...showModulesOf("// modules: { remote: true }\ncreateShow({ world, modules: { keys: false, hands: { mirror: true }, chord: true, audio: 'mic', midi: { controllers: { profile: 'x', open: false } } }, hint: 'a: b' });")].sort(), ['audio', 'chord', 'midi', 'pose']);
  const show = read('packages/show/index.js');
  for (const k of Object.keys(SHOW_MODULES)) assert.match(show, new RegExp(`modules\\.${k}\\b`), `createShow() still reads modules.${k}`);
  assert.deepEqual(examplesUsing({ names: ['noSuchName'] }), []);
});

// ---------------------------------------------------------------------------- example pages
test('next step, example pages: the chapters the example uses, then the next example on its route', async () => {
  const { EXAMPLES, nextOf } = await import('../tools/examples/catalog.mjs');
  for (const e of EXAMPLES) {
    const s = read(`${e.dir}index.html`);
    const region = e.guide === false ? s.match(/<!-- oav:next -->[\s\S]*?<!-- \/oav:next -->/)[0] : s.match(/<!-- oav:guide -->[\s\S]*?<!-- \/oav:guide -->/)[0];
    if (e.guide !== false) assert.match(region, /<h2><span lang="en">Next step<\/span><span lang="zh-Hant">下一步<\/span><\/h2>/, `${e.id}: a Next step heading`);
    for (const d of e.docs) {
      assert.ok(region.includes(`href="../../docs/#${d.id}" data-oav-event="next_step" data-oav-to="docs"`), `${e.id}: chapter ${d.id} (en)`);
      assert.ok(region.includes(`href="../../zh/docs/#${d.id}" data-oav-event="next_step" data-oav-to="docs"`), `${e.id}: chapter ${d.id} (zh)`);
    }
    const next = nextOf(e);
    if (next) {
      assert.ok(region.includes(`href="../../${next.dir}" data-oav-event="next_step" data-oav-to="example"`), `${e.id}: the next example`);
      assert.ok(region.includes(next.route === e.route ? '<b>Next on this route:</b>' : '<b>Next route:</b>'), `${e.id}: says whether it stays on the route`);
    }
    assert.ok(region.includes('data-oav-to="examples"'), `${e.id}: all examples`);
  }
});

// ---------------------------------------------------------------------------- homepage
test('next step, homepage: Made with at the end of the main content, and the course slot renders nothing while empty', async () => {
  const en = (await import('../tools/home/en.mjs')).default, zh = (await import('../tools/home/zh.mjs')).default;
  const { courseLine } = await import('../tools/home/page.mjs');
  for (const [lang, t, rel] of [['en', en, 'index.html'], ['zh', zh, 'zh/index.html']]) {
    const s = read(rel), main = mainOf(s);
    const at = main.indexOf('<nav class="next-step next-home"');
    assert.ok(at > main.lastIndexOf('</section>'), `${lang}: after the last section`);
    assert.deepEqual(linksTo(main.slice(at), 'made_with'), [lang === 'zh' ? '../zh/made-with/' : './made-with/'], `${lang}: Made with`);
    assert.deepEqual(t.next.course, { label: '', url: '' }, `${lang}: the course slot is there, empty (the owner fills it)`);
    assert.ok(!s.includes('next-course') && !s.includes('data-oav-link="course"'), `${lang}: an empty slot leaves no trace`);
    for (const v of [t.next.label, t.next.made]) assert.ok(v && !(lang === 'zh' && ZH_BAD.test(v)), `${lang}: ${v}`);
  }
  assert.equal(courseLine({ label: '', url: '' }), '');
  assert.equal(courseLine({ label: 'A course', url: '' }), '', 'a label without a url renders nothing');
  assert.match(courseLine({ label: 'A course', url: 'https://example.org/course' }), /<a class="more" href="https:\/\/example\.org\/course" rel="noopener" data-oav-link="course">A course ↗<\/a>/);
});

test('next step: the new Chinese strings are written the way the site writes Chinese', async () => {
  const ctl = (await import('../tools/controllers/zh.mjs')).default, ref = (await import('../tools/reference/zh.mjs')).default;
  const { STRINGS } = await import('../tools/examples/strings.mjs');
  const home = (await import('../tools/home/zh.mjs')).default;
  for (const v of [...Object.values(ctl.detail.next), ref.next.title, STRINGS.zh.guide.step, STRINGS.zh.guide.nextSame, STRINGS.zh.guide.nextRoute, home.next.label]) {
    assert.ok(!ZH_BAD.test(v), v);
    assert.ok(/[一-鿿]/.test(v), `${v}: Chinese`);
  }
});
