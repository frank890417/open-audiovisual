// @openav/pattern: one line of mini-notation → the hits of each bar.
// Expected values are written out by hand. The STRUDEL table at the end was confirmed by running each string in
// the strudel.cc REPL on 2026-10-15 and copying the events it printed (onset=value(length), per cycle); Strudel is
// not a dependency of these tests. Euclidean rows are checked against Toussaint (2005) as well.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { compile, parse, WORDS, euclid } from '../packages/pattern/index.js';
import { GM } from '../packages/drums/index.js';

/** { voice: [pos…] } for one bar. */
const byVoice = (src, bar = 1, opts) => {
  const p = compile(src);
  assert.ok(p.ok, `${src}: ${JSON.stringify(p.error)}`);
  const out = {};
  for (const e of p.eventsInBar(bar, opts)) (out[e.voice] ||= []).push(e.pos);
  return out;
};
const frac = (x) => {
  for (let d = 1; d <= 4096; d++) { const n = Math.round(x * d); if (Math.abs(x * d - n) < 1e-12) return d === 1 ? String(n) : `${n}/${d}`; }
  return String(x);
};
const fracNum = (s) => { const [n, d = '1'] = s.split('/'); return Number(n) / Number(d); };
/** The REPL's way of printing a bar: "3/8=bd(1/8)", or '3/8=["bd",2](1/8)' with a sample number. */
const asStrudel = (p, bar) => p.eventsInBar(bar).map((e) => `${frac(e.pos)}=${e.n == null ? e.word : JSON.stringify([e.word, e.n])}(${frac(e.dur)})`);
const sortTokens = (list) => [...list].sort((a, b) => fracNum(a.split('=')[0]) - fracNum(b.split('=')[0]) || (a < b ? -1 : a > b ? 1 : 0));
const err = (src) => { const p = compile(src); assert.equal(p.ok, false, `${JSON.stringify(src)} should fail`); return p.error; };
const grid = (bits) => bits.map((b) => (b ? 'x' : '.')).join('');

// ------------------------------------------------------------------------------------------- acceptance (research note §6)
test('acceptance: "bd*4, [~ sd]*2, hh*8"', () => {
  assert.deepEqual(byVoice('bd*4, [~ sd]*2, hh*8'), {
    kick: [0, 0.25, 0.5, 0.75], snare: [0.25, 0.75], hat: [0, 0.125, 0.25, 0.375, 0.5, 0.625, 0.75, 0.875],
  });
});
test('acceptance: "bd(3,8)" → 0, 0.375, 0.75 (16th grid 0/6/12)', () => {
  assert.deepEqual(byVoice('bd(3,8)').kick, [0, 0.375, 0.75]);
  assert.deepEqual(byVoice('bd(3,8)').kick.map((x) => x * 16), [0, 6, 12]);
});
test('acceptance: "<bd sd>" bar 1 kick, bar 2 snare', () => {
  assert.deepEqual(byVoice('<bd sd>', 1), { kick: [0] });
  assert.deepEqual(byVoice('<bd sd>', 2), { snare: [0] });
});
test('acceptance: "bd!2 sd" equals "bd bd sd"', () => {
  const a = compile('bd!2 sd').eventsInBar(1).map(({ voice, pos, dur }) => ({ voice, pos, dur }));
  const b = compile('bd bd sd').eventsInBar(1).map(({ voice, pos, dur }) => ({ voice, pos, dur }));
  assert.deepEqual(a, b);
});
test('acceptance: "bd@3 sd" → kick 0, snare 0.75', () => {
  assert.deepEqual(byVoice('bd@3 sd'), { kick: [0], snare: [0.75] });
});
test('acceptance: "hh*8?" is decided by seed and bar', () => {
  const p = compile('hh*8?');
  assert.deepEqual(p.eventsInBar(3, { seed: 7 }), p.eventsInBar(3, { seed: 7 }));
  const bars = Array.from({ length: 16 }, (_, i) => p.eventsInBar(i + 1, { seed: 7 }).map((e) => e.pos).join());
  assert.ok(new Set(bars).size > 4, 'different bars come out different');
});

// ------------------------------------------------------------------------------------------- sequences, rests, [ ], ","
const CASES = {
  sequence: [
    ['bd sd', 1, { kick: [0], snare: [0.5] }],
    ['bd sd hh', 1, { kick: [0], snare: [1 / 3], hat: [2 / 3] }],
    ['bd hh sd hh', 1, { kick: [0], hat: [0.25, 0.75], snare: [0.5] }],
    ['  bd\tsd\nhh  ', 1, { kick: [0], snare: [1 / 3], hat: [2 / 3] }],
  ],
  rest: [
    ['bd ~ sd ~', 1, { kick: [0], snare: [0.5] }],
    ['~ bd', 1, { kick: [0.5] }],
    ['bd - sd', 1, { kick: [0], snare: [2 / 3] }],
    ['~ ~', 1, {}],
  ],
  brackets: [
    ['bd [sd sd]', 1, { kick: [0], snare: [0.5, 0.75] }],
    ['bd [sd [hh hh]]', 1, { kick: [0], snare: [0.5], hat: [0.75, 0.875] }],
    ['[bd sd] hh', 1, { kick: [0], snare: [0.25], hat: [0.5] }],
    ['[[bd]]', 1, { kick: [0] }],
  ],
  layers: [
    ['bd*2, hh*3', 1, { kick: [0, 0.5], hat: [0, 1 / 3, 2 / 3] }],
    ['[bd, hh*2] sd', 1, { kick: [0], hat: [0, 0.25], snare: [0.5] }],
    ['bd [sd, hh] , cp', 1, { kick: [0], clap: [0], snare: [0.5], hat: [0.5] }],
    ['bd,sd,hh', 1, { kick: [0], snare: [0], hat: [0] }],
  ],
  fast: [
    ['hh*8', 1, { hat: [0, 0.125, 0.25, 0.375, 0.5, 0.625, 0.75, 0.875] }],
    ['[bd sd]*2', 1, { kick: [0, 0.5], snare: [0.25, 0.75] }],
    ['bd*3 sd', 1, { kick: [0, 1 / 6, 1 / 3], snare: [0.5] }],
    ['bd*1.5', 1, { kick: [0, 2 / 3] }],
    ['bd*1.5', 2, { kick: [1 / 3] }],
  ],
  slow: [
    ['bd/2', 1, { kick: [0] }],
    ['bd/2', 2, {}],
    ['bd/2', 3, { kick: [0] }],
    ['bd cp/2', 1, { kick: [0], clap: [0.5] }],
    ['bd cp/2', 2, { kick: [0] }],
    ['[bd sd]/2', 2, { snare: [0] }],
    ['[bd sd sn]/1.5', 2, { snare: [0], kick: [0.5] }],
  ],
  alternate: [
    ['<bd sd cp>', 3, { clap: [0] }],
    ['<bd sd cp>', 4, { kick: [0] }],
    ['bd <sd cp>', 2, { kick: [0], clap: [0.5] }],
    ['<bd <sd cp>>', 2, { snare: [0] }],
    ['<bd <sd cp>>', 4, { clap: [0] }],
    ['<bd sd>*2', 1, { kick: [0], snare: [0.5] }],
    ['[bd <sd cp>]*2', 1, { kick: [0, 0.5], snare: [0.25], clap: [0.75] }],
    ['<bd sd, hh oh cp>', 4, { snare: [0], hat: [0] }],
    ['<bd@3 sd>', 4, { snare: [0] }],
    ['<[bd*2] sd>', 1, { kick: [0, 0.5] }],
  ],
  replicate: [
    ['bd ! sd', 1, { kick: [0, 1 / 3], snare: [2 / 3] }],
    ['bd! sd', 1, { kick: [0, 1 / 3], snare: [2 / 3] }],
    ['bd!3 sd', 1, { kick: [0, 0.25, 0.5], snare: [0.75] }],
    ['bd!3 !', 1, { kick: [0, 0.25, 0.5, 0.75] }],
    ['bd!2!2', 1, { kick: [0, 1 / 3, 2 / 3] }],
    ['[bd sd]!', 1, { kick: [0, 0.5], snare: [0.25, 0.75] }],
    ['<bd sd>!2 hh', 2, { snare: [0, 1 / 3], hat: [2 / 3] }],
  ],
  elongate: [
    ['bd sd@0.5', 1, { kick: [0], snare: [2 / 3] }],
    ['[bd sd]@3 hh', 1, { kick: [0], snare: [0.375], hat: [0.75] }],
    ['bd @2 sd', 1, { kick: [0], snare: [2 / 3] }],
    ['bd _ _ sd', 1, { kick: [0], snare: [0.75] }],
    ['bd _ sd', 1, { kick: [0], snare: [2 / 3] }],
    ['bd ~@3', 1, { kick: [0] }],
  ],
  euclidInContext: [
    ['bd(3,8,2)', 1, { kick: [0, 0.25, 0.625] }],
    ['bd(3,8) sd', 1, { kick: [0, 3 / 16, 3 / 8], snare: [0.5] }],
    ['[bd sd](3,8)', 1, { kick: [0, 0.375], snare: [0.75] }],
    ['<bd sd>(3,8)', 2, { snare: [0, 0.375, 0.75] }],
    ['bd(3,8)*2', 1, { kick: [0, 3 / 16, 3 / 8, 0.5, 11 / 16, 7 / 8] }],
    ['[~ bd](3,8)', 1, { kick: [0.75] }],
    ['bd(5,8,2), hh*8', 1, { kick: [0, 0.25, 0.5, 0.625, 0.875], hat: [0, 0.125, 0.25, 0.375, 0.5, 0.625, 0.75, 0.875] }],
  ],
};
for (const [kind, cases] of Object.entries(CASES)) {
  for (const [src, bar, want] of cases) {
    test(`${kind}: ${JSON.stringify(src)} bar ${bar}`, () => assert.deepEqual(byVoice(src, bar), want));
  }
}

test('lengths: "bd@3 sd", "bd/2", "bd cp/2", "[bd sd]*2"', () => {
  const durs = (src, bar = 1) => compile(src).eventsInBar(bar).map((e) => [e.word, e.dur]);
  assert.deepEqual(durs('bd@3 sd'), [['bd', 0.75], ['sd', 0.25]]);
  assert.deepEqual(durs('bd/2'), [['bd', 2]]);                 // runs past the bar: it lasts two
  assert.deepEqual(durs('bd cp/2'), [['bd', 0.5], ['cp', 1]]);
  assert.deepEqual(durs('[bd sd]*2'), [['bd', 0.25], ['sd', 0.25], ['bd', 0.25], ['sd', 0.25]]);
});

// ------------------------------------------------------------------------------------------- Euclid (Toussaint 2005)
// Section 4 of the paper, as printed. The four rows with one rest — E(2,3), E(3,4), E(5,6), E(7,8) — are printed
// as x.x, x.xx, x.xxxx, x.xxxxxx: rotations (same necklace) of what the paper's own stopping rule produces
// ("stops when the remainder consists of only one sequence"), which is also what strudel.cc plays. OAV plays strudel.cc's.
const TOUSSAINT = {
  '1,2': 'x.', '1,3': 'x..', '1,4': 'x...', '4,12': 'x..x..x..x..', '2,5': 'x.x..', '3,5': 'x.x.x', '3,7': 'x.x.x..',
  '3,8': 'x..x..x.', '4,7': 'x.x.x.x', '4,9': 'x.x.x.x..', '4,11': 'x..x..x..x.', '5,7': 'x.xx.xx', '5,8': 'x.xx.xx.',
  '5,9': 'x.x.x.x.x', '5,11': 'x.x.x.x.x..', '5,12': 'x..x.x..x.x.', '5,13': 'x..x.x..x.x..', '5,16': 'x..x..x..x..x...',
  '7,12': 'x.xx.x.xx.x.', '7,16': 'x..x.x.x..x.x.x.', '9,16': 'x.xx.x.x.xx.x.x.',
  '11,24': 'x..x.x.x.x.x..x.x.x.x.x.',     // interval vector (32222322222)
  '13,24': 'x.xx.x.x.x.x.xx.x.x.x.x.',     // interval vector (2122222122222)
};
for (const [kn, want] of Object.entries(TOUSSAINT)) {
  test(`euclid: E(${kn}) = ${want} (Toussaint 2005, strudel.cc)`, () => {
    const [k, n] = kn.split(',').map(Number);
    assert.equal(grid(euclid(k, n)), want);
  });
}
const ONE_REST = { '2,3': ['xx.', 'x.x'], '3,4': ['xxx.', 'x.xx'], '5,6': ['xxxxx.', 'x.xxxx'], '7,8': ['xxxxxxx.', 'x.xxxxxx'] };
for (const [kn, [plays, printed]] of Object.entries(ONE_REST)) {
  test(`euclid: E(${kn}) plays ${plays} (strudel.cc), a rotation of the paper's ${printed}`, () => {
    const [k, n] = kn.split(',').map(Number);
    const got = grid(euclid(k, n));
    assert.equal(got, plays);
    assert.ok((got + got).includes(printed), 'same necklace');
  });
}
const ROTATIONS = [   // [k, n, r, grid] — r starts the pattern r steps later (strudel.cc)
  [3, 8, 1, '.x..x..x'], [3, 8, 2, 'x.x..x..'], [3, 8, 3, '.x.x..x.'], [3, 8, -1, '..x..x.x'], [3, 8, -2, '.x..x.x.'],
  [3, 8, 10, 'x.x..x..'], [5, 8, 1, '.x.xx.xx'], [5, 8, 2, 'x.x.xx.x'], [5, 8, 3, 'xx.x.xx.'], [2, 5, 1, '.x.x.'],
  [7, 16, 4, 'x.x.x..x.x.x..x.'], [3, 4, 1, '.xxx'], [5, 16, -3, 'x..x..x..x...x..'],
];
for (const [k, n, r, want] of ROTATIONS) {
  test(`euclid: (${k},${n},${r}) = ${want}`, () => assert.equal(grid(euclid(k, n, r)), want));
}
test('euclid: edges — (0,8) silent, (8,8) every step, (-3,8) the gaps of (3,8)', () => {
  assert.equal(grid(euclid(0, 8)), '........');
  assert.equal(grid(euclid(8, 8)), 'xxxxxxxx');
  assert.equal(grid(euclid(-3, 8)), '.xx.xx.x');
  assert.deepEqual(byVoice('bd(0,8) sd'), { snare: [0.5] });
});

// ------------------------------------------------------------------------------------------- "?" (seeded)
test('maybe: same seed and bar → same hits; the call order does not matter', () => {
  const p = compile('hh*16?, bd*4?0.3');
  const first = p.eventsInBar(5, { seed: 'class-4' });
  p.eventsInBar(9, { seed: 'class-4' }); p.eventsInBar(1, { seed: 1 });
  assert.deepEqual(p.eventsInBar(5, { seed: 'class-4' }), first);
  assert.deepEqual(compile('hh*16?, bd*4?0.3').eventsInBar(5, { seed: 'class-4' }), first, 'a fresh compile agrees');
});
test('maybe: another seed gives another rhythm', () => {
  const p = compile('hh*16?');
  const run = (seed) => Array.from({ length: 8 }, (_, i) => p.eventsInBar(i + 1, { seed }).map((e) => e.pos).join()).join('|');
  assert.notEqual(run(1), run(2));
  assert.equal(run(undefined), run(0), 'no seed = seed 0');
});
test('maybe: "?" drops about half, "?0.3" about 30%, "?0" none, "?1" all', () => {
  const kept = (src) => { const p = compile(src); let n = 0; for (let b = 1; b <= 128; b++) n += p.eventsInBar(b, { seed: 3 }).length; return n / (128 * 8); };
  const half = kept('hh*8?');
  assert.ok(half > 0.42 && half < 0.58, `kept ${half}`);
  const most = kept('hh*8?0.3');
  assert.ok(most > 0.62 && most < 0.78, `kept ${most}`);
  assert.equal(kept('hh*8?0'), 1);
  assert.equal(kept('hh*8?1'), 0);
});
test('maybe: each "?" and each repeat decides on its own', () => {
  const p = compile('hh?!2, sd? sd?');
  let differ = 0, differ2 = 0;
  for (let b = 1; b <= 64; b++) {
    const ev = p.eventsInBar(b, { seed: 5 });
    const hh = ev.filter((e) => e.word === 'hh').map((e) => e.pos), sd = ev.filter((e) => e.word === 'sd').map((e) => e.pos);
    if (hh.length === 1) differ++;
    if (sd.length === 1) differ2++;
  }
  assert.ok(differ > 10 && differ2 > 10, `hh ${differ}, sd ${differ2}`);
});

// ------------------------------------------------------------------------------------------- ":n" sample numbers
test('sample number: "bd:2 sd:10" → n 2 and 10, token covers the colon', () => {
  const ev = compile('bd:2 sd:10').eventsInBar(1);
  assert.deepEqual(ev.map((e) => [e.voice, e.n, e.token]), [['kick', 2, { start: 0, end: 4 }], ['snare', 10, { start: 5, end: 10 }]]);
});
test('sample number: "bd:2*2" keeps n on every hit; plain words have n = null', () => {
  assert.deepEqual(compile('bd:2*2').eventsInBar(1).map((e) => e.n), [2, 2]);
  assert.deepEqual(compile('bd sd').eventsInBar(1).map((e) => e.n), [null, null]);
});
test('sample number: "hh:0.5" and "<bd:1 bd:3>"', () => {
  assert.equal(compile('hh:0.5').eventsInBar(1)[0].n, 0.5);
  assert.deepEqual([1, 2].map((b) => compile('<bd:1 bd:3>').eventsInBar(b)[0].n), [1, 3]);
});

// ------------------------------------------------------------------------------------------- errors
const ERRORS = [
  ['bd [sd', 'unclosed', 3, 1],
  ['bd(3,8', 'unclosed', 2, 1],
  ['<bd sd', 'unclosed', 0, 1],
  ['bd . sd', 'unsupported', 3, 1],
  ['kik', 'unknown-word', 0, 3],
  ['', 'empty', 0, 1],
  ['   ', 'empty', 0, 3],
  ['[]', 'empty', 0, 2],
  ['bd < > sd', 'empty', 3, 3],
  ['bd,', 'empty', 2, 1],
  [', bd', 'empty', 0, 1],
  ['bd ]', 'unexpected', 3, 1],
  ['[bd sd>', 'unexpected', 6, 1],
  ['! bd', 'unexpected', 0, 1],
  ['bd*', 'bad-number', 2, 1],
  ['bd*0', 'bad-number', 2, 2],
  ['bd/0 sd', 'bad-number', 2, 2],
  ['bd@0 sd', 'bad-number', 2, 2],
  ['bd*<2 3>', 'bad-number', 2, 1],
  ['hh?2', 'bad-number', 2, 2],
  ['bd:x', 'bad-number', 2, 1],
  ['bd(9,8)', 'bad-euclid', 2, 5],
  ['bd(3)', 'bad-euclid', 2, 3],
  ['bd(3,8,1.5)', 'bad-euclid', 2, 9],
  ['bd(3,0)', 'bad-euclid', 2, 5],
  ['bd(a,8)', 'bad-euclid', 2, 2],
  ['bd | sd', 'unsupported', 3, 1],
  ['{bd sd}', 'unsupported', 0, 1],
  ['0 .. 3', 'unsupported', 2, 2],
  ['bd ＊2', 'unexpected', 3, 1],
  ['"bd sd"', 'unexpected', 0, 1],
  ['x...x...', 'unknown-word', 0, 8],
  ['1 0 1', 'unknown-word', 0, 1],
  ['bd sd snarf', 'unknown-word', 6, 5],
];
for (const [src, code, index, length] of ERRORS) {
  test(`error: ${JSON.stringify(src)} → ${code} at ${index}`, () => {
    const e = err(src);
    assert.equal(e.code, code);
    assert.equal(e.index, index, 'index');
    assert.equal(e.length, length, 'length');
    assert.ok(typeof e.message === 'string' && e.message.length > 5 && typeof e.hint === 'string' && e.hint.length > 5);
  });
}
test('error: "kik" suggests kick, "snar" suggests snare, "hihat" suggests hat', () => {
  assert.equal(err('kik').suggestion, 'kick');
  assert.match(err('kik').hint, /kick/);
  assert.equal(err('bd snar').suggestion, 'snare');
  assert.equal(err('hihat').suggestion, 'hat');
  assert.equal(err('zzzzzz').suggestion, null);
});
test('error: "bd . sd" tells the reader to rest with ~ or -; full-width and quotes get their own hints', () => {
  assert.match(err('bd . sd').hint, /~ or -/);
  assert.match(err('bd ＊2').hint, /半形/);
  assert.match(err('"bd sd"').hint, /quotes/);
});
test('error: compile never throws, and a failed pattern plays nothing', () => {
  for (const src of [null, undefined, 42, {}, [], '[[[[', ']]]', '(((', 'bd(((', '<<>>', '~*', '@', '?', 'bd!0', 'bd:', '\u0000']) {
    const p = compile(src);
    assert.equal(typeof p.ok, 'boolean');
    if (!p.ok) {
      assert.deepEqual(p.eventsInBar(1), []);
      assert.ok(p.error.code && Number.isInteger(p.error.index) && p.error.length >= 1);
    }
  }
  assert.equal(compile(null).error.code, 'empty');
  assert.equal(compile(42).error.code, 'unknown-word');
});

// ------------------------------------------------------------------------------------------- the event, the words, the tree
test('event shape: word, voice, n, pos, dur, vel, layer, token', () => {
  const ev = compile('bd*4, [~ sd]*2, hh*8').eventsInBar(1);
  assert.deepEqual(Object.keys(ev[0]).sort(), ['dur', 'layer', 'n', 'pos', 'token', 'vel', 'voice', 'word']);
  assert.deepEqual(ev.slice(0, 3).map((e) => [e.word, e.voice, e.layer, e.token, e.vel]), [
    ['bd', 'kick', 0, { start: 0, end: 2 }, 1], ['hh', 'hat', 2, { start: 16, end: 18 }, 1], ['hh', 'hat', 2, { start: 16, end: 18 }, 1],
  ]);
  assert.deepEqual(ev.find((e) => e.word === 'sd').token, { start: 9, end: 11 });
  for (let i = 1; i < ev.length; i++) assert.ok(ev[i - 1].pos <= ev[i].pos, 'sorted by pos');
});
test('tokens point at the word that sounds, even inside < > and repeats', () => {
  const src = '<bd [sd cp]> hh!2';
  const p = compile(src);
  const words = (bar) => p.eventsInBar(bar).map((e) => src.slice(e.token.start, e.token.end));
  assert.deepEqual(words(1), ['bd', 'hh', 'hh']);
  assert.deepEqual(words(2), ['sd', 'cp', 'hh', 'hh']);
});
test('compiled pattern: src, voices in order, layer count, period in bars', () => {
  const p = compile('bd*4, [~ sd]*2, hh*8');
  assert.equal(p.src, 'bd*4, [~ sd]*2, hh*8');
  assert.deepEqual(p.voices, ['kick', 'snare', 'hat']);
  assert.equal(p.layers, 3);
  for (const [src, bars] of [['bd*4', 1], ['<bd sd>', 2], ['bd/2', 2], ['<bd <sd cp>>', 4], ['bd*1.5', 2], ['<bd sd>*2', 1], ['<bd sd, hh oh cp>', 6], ['hh*8?', 1], ['<bd@3 sd>', 4]]) {
    assert.equal(compile(src).period, bars, src);
  }
});
test('words: every voice is a kit voice of @openav/drums; short names and OAV names both work, any case', () => {
  for (const [w, v] of Object.entries(WORDS)) assert.ok(v in GM, `${w} → ${v}`);
  const want = { bd: 'kick', sd: 'snare', hh: 'hat', cp: 'clap', oh: 'openhat', rim: 'rim', rs: 'rim', lt: 'lowtom', mt: 'tom', ht: 'hightom', cr: 'crash', rd: 'ride', cb: 'cowbell' };
  for (const [w, v] of Object.entries(want)) assert.equal(WORDS[w], v, w);
  for (const v of Object.keys(GM)) assert.equal(WORDS[v], v, `${v} is its own word`);
  assert.deepEqual(byVoice('BD Kick'), { kick: [0, 0.5] });
});
test('time does not drift: bar 1 000 000 lands on the same fractions as bar 1', () => {
  const p = compile('[bd sd sn]*3, hh(5,16), cp*7');
  const at = (bar) => p.eventsInBar(bar).map((e) => [e.word, e.pos, e.dur]);
  assert.deepEqual(at(1_000_000), at(1));
  assert.ok(at(1).some(([w, pos]) => w === 'sd' && pos === 1 / 9), 'ninths are the float of k/9, not a sum');
  const q = compile('bd*1.5');
  assert.deepEqual(q.eventsInBar(999_999).map((e) => e.pos), [0, 2 / 3]);
  assert.deepEqual(q.eventsInBar(1_000_000).map((e) => e.pos), [1 / 3]);
});
test('parse: a tree with character ranges and OAV node names; never throws', () => {
  const r = parse('bd*2 [sd, hh] <cp oh>');
  assert.equal(r.ok, true);
  assert.equal(r.tree.type, 'layer');
  const [seq] = r.tree.layers;
  assert.equal(seq.type, 'seq');
  assert.deepEqual(seq.steps.map((s) => s.node.type), ['fast', 'layer', 'alt']);
  assert.deepEqual(seq.steps[0].node.node, { type: 'step', word: 'bd', n: null, start: 0, end: 2 });
  const bad = parse('bd [sd');
  assert.equal(bad.ok, false);
  assert.equal(bad.error.code, 'unclosed');
  assert.equal(parse(undefined).ok, false);
});

// ------------------------------------------------------------------------------------------- strudel.cc (REPL, 2026-10-15)
// [string, [bar 1, bar 2, …]] exactly as the REPL printed them.
const STRUDEL = [
  ['bd*4, [~ sd]*2, hh*8', ['0=bd(1/4) 0=hh(1/8) 1/8=hh(1/8) 1/4=bd(1/4) 1/4=sd(1/4) 1/4=hh(1/8) 3/8=hh(1/8) 1/2=bd(1/4) 1/2=hh(1/8) 5/8=hh(1/8) 3/4=bd(1/4) 3/4=sd(1/4) 3/4=hh(1/8) 7/8=hh(1/8)']],
  ['bd(3,8)', ['0=bd(1/8) 3/8=bd(1/8) 3/4=bd(1/8)']],
  ['bd(3,8,2)', ['0=bd(1/8) 1/4=bd(1/8) 5/8=bd(1/8)']],
  ['bd(3,8,1)', ['1/8=bd(1/8) 1/2=bd(1/8) 7/8=bd(1/8)']],
  ['bd(3,8,-1)', ['1/4=bd(1/8) 5/8=bd(1/8) 7/8=bd(1/8)']],
  ['bd(5,8)', ['0=bd(1/8) 1/4=bd(1/8) 3/8=bd(1/8) 5/8=bd(1/8) 3/4=bd(1/8)']],
  ['bd(5,8,2)', ['0=bd(1/8) 1/4=bd(1/8) 1/2=bd(1/8) 5/8=bd(1/8) 7/8=bd(1/8)']],
  ['<bd sd>', ['0=bd(1)', '0=sd(1)']],
  ['bd!2 sd', ['0=bd(1/3) 1/3=bd(1/3) 2/3=sd(1/3)']],
  ['bd ! sd', ['0=bd(1/3) 1/3=bd(1/3) 2/3=sd(1/3)']],
  ['bd! sd', ['0=bd(1/3) 1/3=bd(1/3) 2/3=sd(1/3)']],
  ['bd@3 sd', ['0=bd(3/4) 3/4=sd(1/4)']],
  ['bd/2', ['0=bd(2)', '', '0=bd(2)']],
  ['bd cp/2', ['0=bd(1/2) 1/2=cp(1)', '0=bd(1/2)', '0=bd(1/2) 1/2=cp(1)']],
  ['[bd sd]/2', ['0=bd(1)', '0=sd(1)', '0=bd(1)']],
  ['[bd sd sn]/1.5', ['0=bd(1/2) 1/2=sd(1/2)', '0=sn(1/2) 1/2=bd(1/2)', '0=sd(1/2) 1/2=sn(1/2)']],
  ['bd*1.5', ['0=bd(2/3) 2/3=bd(2/3)', '1/3=bd(2/3)']],
  ['[bd sd]*1.5', ['0=bd(1/3) 1/3=sd(1/3) 2/3=bd(1/3)', '0=sd(1/3) 1/3=bd(1/3) 2/3=sd(1/3)']],
  ['<bd@3 sd>', ['0=bd(3)', '', '', '0=sd(1)', '0=bd(3)']],
  ['<bd sd>*2', ['0=bd(1/2) 1/2=sd(1/2)']],
  ['<bd <sd cp>>', ['0=bd(1)', '0=sd(1)', '0=bd(1)', '0=cp(1)']],
  ['bd <sd cp>', ['0=bd(1/2) 1/2=sd(1/2)', '0=bd(1/2) 1/2=cp(1/2)']],
  ['[bd <sd cp>]*2', ['0=bd(1/4) 1/4=sd(1/4) 1/2=bd(1/4) 3/4=cp(1/4)', '0=bd(1/4) 1/4=sd(1/4) 1/2=bd(1/4) 3/4=cp(1/4)']],
  ['<bd sd, hh oh cp>', ['0=bd(1) 0=hh(1)', '0=sd(1) 0=oh(1)', '0=bd(1) 0=cp(1)', '0=sd(1) 0=hh(1)', '0=bd(1) 0=oh(1)', '0=sd(1) 0=cp(1)']],
  ['<[bd*2] sd>', ['0=bd(1/2) 1/2=bd(1/2)', '0=sd(1)']],
  ['<bd sd>(3,8)', ['0=bd(1/8) 3/8=bd(1/8) 3/4=bd(1/8)', '0=sd(1/8) 3/8=sd(1/8) 3/4=sd(1/8)']],
  ['[bd sd](3,8)', ['0=bd(1/8) 3/8=bd(1/8) 3/4=sd(1/8)']],
  ['bd(3,8)*2', ['0=bd(1/16) 3/16=bd(1/16) 3/8=bd(1/16) 1/2=bd(1/16) 11/16=bd(1/16) 7/8=bd(1/16)']],
  ['bd(3,8) sd', ['0=bd(1/16) 3/16=bd(1/16) 3/8=bd(1/16) 1/2=sd(1/2)']],
  ['bd _ _ sd', ['0=bd(3/4) 3/4=sd(1/4)']],
  ['bd _ sd', ['0=bd(2/3) 2/3=sd(1/3)']],
  ['bd:2 sd:10', ['0=["bd",2](1/2) 1/2=["sd",10](1/2)']],
  ['bd:2*2', ['0=["bd",2](1/2) 1/2=["bd",2](1/2)']],
  ['- bd', ['1/2=bd(1/2)']],
  ['bd - sd', ['0=bd(1/3) 2/3=sd(1/3)']],
  ['bd(5,8,1)', ['1/8=bd(1/8) 3/8=bd(1/8) 1/2=bd(1/8) 3/4=bd(1/8) 7/8=bd(1/8)']],
  ['bd(0,8)', ['']],
  ['bd(8,8)', ['0=bd(1/8) 1/8=bd(1/8) 1/4=bd(1/8) 3/8=bd(1/8) 1/2=bd(1/8) 5/8=bd(1/8) 3/4=bd(1/8) 7/8=bd(1/8)']],
  ['[bd, hh*2] sd', ['0=bd(1/2) 0=hh(1/4) 1/4=hh(1/4) 1/2=sd(1/2)']],
  ['bd [sd [hh hh]]', ['0=bd(1/2) 1/2=sd(1/4) 3/4=hh(1/8) 7/8=hh(1/8)']],
  ['<bd sd>/2', ['0=bd(2)', '', '0=sd(2)', '']],
  ['bd/2(3,8)', ['0=bd(1/8) 3/8=bd(1/8) 3/4=bd(1/8)', '0=bd(1/8) 3/8=bd(1/8) 3/4=bd(1/8)']],
  ['[~ bd](3,8)', ['3/4=bd(1/8)']],
  ['[bd sd hh cp](3,8)', ['0=bd(1/8) 3/8=sd(1/8) 3/4=cp(1/8)']],
  ['bd*16(3,8)', ['0=bd(1/8) 3/8=bd(1/8) 3/4=bd(1/8)']],
  ['bd sd@0.5', ['0=bd(2/3) 2/3=sd(1/3)']],
  ['[bd sd]@3 hh', ['0=bd(3/8) 3/8=sd(3/8) 3/4=hh(1/4)']],
  ['<bd sd>!2 hh', ['0=bd(1/3) 1/3=bd(1/3) 2/3=hh(1/3)', '0=sd(1/3) 1/3=sd(1/3) 2/3=hh(1/3)']],
  ['<bd!2 sd>', ['0=bd(1)', '0=bd(1)', '0=sd(1)']],
  ['<bd sd>@3 hh', ['0=bd(3/4) 3/4=hh(1/4)', '0=sd(3/4) 3/4=hh(1/4)']],
  ['bd [sd, hh] , cp', ['0=bd(1/2) 0=cp(1) 1/2=sd(1/2) 1/2=hh(1/2)']],
  ['bd(3,8,0)', ['0=bd(1/8) 3/8=bd(1/8) 3/4=bd(1/8)']],
  ['bd(-3,8)', ['1/8=bd(1/8) 1/4=bd(1/8) 1/2=bd(1/8) 5/8=bd(1/8) 7/8=bd(1/8)']],
  ['~ ~', ['']],
  ['bd ~@3', ['0=bd(1/4)']],
  ['bd _', ['0=bd(1)']],
  ['bd\nsd\thh', ['0=bd(1/3) 1/3=sd(1/3) 2/3=hh(1/3)']],
  ['bd [~ sd]@2', ['0=bd(1/3) 2/3=sd(1/3)']],
  ['bd!3 sd', ['0=bd(1/4) 1/4=bd(1/4) 1/2=bd(1/4) 3/4=sd(1/4)']],
  ['bd*2!2 sd', ['0=bd(1/6) 1/6=bd(1/6) 1/3=bd(1/6) 1/2=bd(1/6) 2/3=sd(1/3)']],
  ['bd!2*2 sd', ['0=bd(1/6) 1/6=bd(1/6) 1/3=bd(1/6) 1/2=bd(1/6) 2/3=sd(1/3)']],
  ['bd(3,8)!2', ['0=bd(1/16) 3/16=bd(1/16) 3/8=bd(1/16) 1/2=bd(1/16) 11/16=bd(1/16) 7/8=bd(1/16)']],
  ['<bd*2 sd/2>', ['0=bd(1/2) 1/2=bd(1/2)', '0=sd(2)', '0=bd(1/2) 1/2=bd(1/2)', '']],
  ['[bd sd]!', ['0=bd(1/4) 1/4=sd(1/4) 1/2=bd(1/4) 3/4=sd(1/4)']],
  ['bd @2 sd', ['0=bd(2/3) 2/3=sd(1/3)']],
  ['bd(3,8)@3 sd', ['0=bd(3/32) 9/32=bd(3/32) 9/16=bd(3/32) 3/4=sd(1/4)']],
  ['bd *2 sd', ['0=bd(1/4) 1/4=bd(1/4) 1/2=sd(1/2)']],
  ['bd!2!2', ['0=bd(1/3) 1/3=bd(1/3) 2/3=bd(1/3)']],
  ['bd ! ! sd', ['0=bd(1/4) 1/4=bd(1/4) 1/2=bd(1/4) 3/4=sd(1/4)']],
  ['bd!3 !', ['0=bd(1/4) 1/4=bd(1/4) 1/2=bd(1/4) 3/4=bd(1/4)']],
  ['<bd [sd cp]>!2', ['0=bd(1/2) 1/2=bd(1/2)', '0=sd(1/4) 1/4=cp(1/4) 1/2=sd(1/4) 3/4=cp(1/4)']],
];
for (const [src, bars] of STRUDEL) {
  test(`strudel.cc: ${JSON.stringify(src)}`, () => {
    const p = compile(src);
    assert.ok(p.ok, JSON.stringify(p.error));
    bars.forEach((want, i) => {
      assert.deepEqual(sortTokens(asStrudel(p, i + 1)), sortTokens(want.split(' ').filter(Boolean)), `bar ${i + 1}`);
    });
  });
}
// The one place OAV parts ways on purpose: a rotation of n or more steps. strudel.cc (2026-10-15) plays "bd(3,8,8)",
// "bd(3,8,10)", "bd(3,8,-9)" … unrotated (it wraps only between -n and n); OAV wraps every rotation around the bar.
test('strudel.cc difference: rotations of n steps or more wrap around in OAV', () => {
  assert.deepEqual(byVoice('bd(3,8,10)').kick, byVoice('bd(3,8,2)').kick);
  assert.deepEqual(byVoice('bd(3,8,8)').kick, byVoice('bd(3,8)').kick);
  assert.deepEqual(byVoice('bd(3,8,7)').kick.map((x) => x * 8), [2, 5, 7]);    // same as strudel.cc below n
  assert.deepEqual(byVoice('bd(3,8,-7)').kick.map((x) => x * 8), [1, 4, 7]);
});
// Strudel also refuses these (its parser reports an error); OAV says which character and why.
for (const src of ['bd [sd', 'bd(3,8', '[bd sd', 'bd]', 'bd,', ',bd', 'bd,,sd', '[]', '<>', 'bd [] sd', 'bd*', 'bd(3)', 'bd(3,)', 'bd(,8)']) {
  test(`strudel.cc refuses ${JSON.stringify(src)}, so does OAV`, () => assert.equal(compile(src).ok, false));
}
