// Example 14 · timeline — its declared show must be a legal timeline: every param has a lane or a
// reason not to, keyframes sit inside the show and inside the param's range, scenes and cues are
// ordered and in range, and the baked curves land exactly on their keyframes.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { Timeline, CURVES } from '../packages/timeline/index.js';
import { TOTAL, PARAMS, SCENES, LANES, compile, cues } from '../examples/14-timeline/config.js';

const byKey = Object.fromEntries(PARAMS.map((p) => [p.key, p]));
const near = (a, b, e = 1e-6) => assert.ok(Math.abs(a - b) <= e, `${a} !~ ${b}`);

test('every continuous param has exactly one lane; pulses have none', () => {
  const lanes = LANES.map((l) => l.key);
  assert.equal(new Set(lanes).size, lanes.length, 'duplicate lane');
  for (const p of PARAMS) {
    if (p.pulse) assert.ok(!lanes.includes(p.key), `${p.key} is a pulse, it cannot have a lane`);
    else assert.ok(lanes.includes(p.key), `${p.key} has no lane`);
  }
  for (const k of lanes) assert.ok(byKey[k], `lane ${k} is not a param`);
});

test('anchors: ascending, inside [0, total], inside the param range, known curve kinds', () => {
  for (const lane of LANES) {
    const p = byKey[lane.key];
    assert.ok(lane.anchors.length >= 2, lane.key);
    let last = -Infinity;
    for (const [t, v, kind = 'linear'] of lane.anchors) {
      assert.ok(t > last, `${lane.key}: anchor times must ascend (${t})`);
      assert.ok(t >= 0 && t <= TOTAL, `${lane.key}: ${t}s is outside the show`);
      assert.ok(v >= p.min && v <= p.max, `${lane.key}: ${v} is outside ${p.min}..${p.max}`);
      assert.ok(kind in CURVES, `${lane.key}: unknown curve "${kind}"`);
      last = t;
    }
  }
});

test('the example shows every curve kind at least once (and a step param)', () => {
  const used = new Set(LANES.flatMap((l) => l.anchors.map((a) => a[2] || 'linear')));
  for (const k of Object.keys(CURVES)) assert.ok(used.has(k), `no lane uses "${k}"`);
  assert.ok(PARAMS.some((p) => p.step), 'a step param (holds values) is part of the lesson');
});

test('scenes: start at 0, ascending, inside the show; ids unique', () => {
  assert.equal(SCENES[0].t, 0);
  const ids = new Set();
  SCENES.forEach((s, i) => {
    assert.ok(!ids.has(s.id)); ids.add(s.id);
    assert.ok(s.title && s.note, s.id);
    assert.ok(s.t < TOTAL);
    if (i) assert.ok(s.t > SCENES[i - 1].t);
  });
});

test('cues: each sits inside its own scene, fires a declared pulse, none duplicated in time', () => {
  const list = cues(SCENES);
  assert.ok(list.length >= 3);
  const seen = new Set();
  for (const c of list) {
    const i = SCENES.findIndex((s) => s.id === c.scene);
    const end = i + 1 < SCENES.length ? SCENES[i + 1].t : TOTAL;
    assert.ok(c.t >= SCENES[i].t && c.t < end, `cue ${c.name}@${c.t} is outside scene ${c.scene}`);
    assert.ok(byKey[c.name]?.pulse, `cue ${c.name} must name a pulse param`);
    assert.ok(!seen.has(c.t), `two cues at ${c.t}`); seen.add(c.t);
  }
  assert.ok(new Set(list.map((c) => c.name)).size >= 2, 'two different events');
  for (const s of SCENES) for (const c of s.cues || []) assert.ok(typeof c.t === 'number' && c.name, 'scene.cues keep the {name,t} shape the console scrubber draws');
});

test('compile(): the automation hits every anchor and never leaves the param range', () => {
  const automation = compile(LANES);
  const tl = new Timeline({ params: PARAMS, automation, scenes: SCENES, total: TOTAL });
  for (const lane of LANES) {
    const p = byKey[lane.key];
    for (const [t, v] of lane.anchors) near(tl.valueAt(lane.key, t), v, 1e-6);
    for (let t = 0; t <= TOTAL; t += 0.05) {
      const v = tl.valueAt(lane.key, t);
      assert.ok(v >= p.min - 1e-9 && v <= p.max + 1e-9, `${lane.key}@${t} = ${v}`);
    }
  }
});

test('the curve kinds on a keyframe differ — ease/in/out/step are not the linear midpoint', () => {
  const mid = (kind) => { const a = compile([{ key: 'x', anchors: [[0, 0], [10, 100, kind]] }]).x; const tl = new Timeline({ params: [{ key: 'x', min: 0, max: 100, def: 0 }], automation: { x: a }, total: 10 }); return tl.valueAt('x', 5); };
  near(mid('linear'), 50);
  near(mid('ease'), 50, 0.5);            // smoothstep is symmetric
  assert.ok(mid('in') < 40, 'ease-in starts slow');
  assert.ok(mid('out') > 60, 'ease-out starts fast');
  near(mid('step'), 0);                  // holds the old value until the anchor, then jumps
  const stepTl = new Timeline({ params: [{ key: 'x', min: 0, max: 100, def: 0 }], automation: compile([{ key: 'x', anchors: [[0, 0], [10, 100, 'step']] }]), total: 10 });
  near(stepTl.valueAt('x', 10), 100);
});

test('compile() hands the anchors over as copies (a recording must not edit the declaration)', () => {
  const auto = compile(LANES);
  assert.deepEqual(auto.hue, LANES[0].anchors);
  auto.hue[0][1] = 999; auto.hue.push([41, 0]);
  assert.equal(LANES[0].anchors[0][1], 200); assert.equal(LANES[0].anchors.length, 5);
});

test('the timeline fires the example\'s cues itself: playing through gives them in order, once; the loop gives them again', () => {
  const tl = new Timeline({ params: PARAMS, automation: compile(LANES), scenes: SCENES, total: TOTAL, loop: true });
  const got = []; tl.onCue((c) => got.push(c.t));
  tl.play();
  for (let i = 0; i < 400; i++) tl.advance(0.1);            // one full lap (give or take a float)
  assert.deepEqual(got, cues(SCENES).map((c) => c.t));
  for (let i = 0; i < 150; i++) tl.advance(0.1);            // about 15 s into lap two (past the cues at 8 and 14)
  assert.deepEqual(got, [...cues(SCENES).map((c) => c.t), 8, 14]);
  tl.seek(5); tl.seek(39);                                  // scrubbing past fires nothing
  assert.equal(got.length, cues(SCENES).length + 2);
});

test('a `step` param holds each keyframe (shape never lands between two shapes)', () => {
  const automation = compile(LANES);
  const tl = new Timeline({ params: PARAMS, automation, scenes: SCENES, total: TOTAL });
  for (const p of PARAMS.filter((q) => q.step)) for (let t = 0; t <= TOTAL; t += 0.1) { const v = tl.valueAt(p.key, t); assert.equal(v, Math.round(v / p.step) * p.step, `${p.key}@${t}`); }
});

test('the page wires the example: importmap has the packages it uses, thumbnail exists', () => {
  const html = fs.readFileSync('examples/14-timeline/index.html', 'utf8');
  for (const m of ['@openav/show', '@openav/stage', '@openav/timeline', '@openav/console']) assert.ok(html.includes(`"${m}"`), m);
  assert.ok(/<title>Timeline · open-audiovisual example<\/title>/.test(html));   // the head region of tools/build-examples.mjs
  assert.ok(fs.existsSync('assets/home/works/14.webp'));
  assert.ok(fs.statSync('assets/home/works/14.webp').size <= 120 * 1024);
});
