// The search core (assets/search/core.js): matching and ranking shared by the reference page's box and the nav's search dialog.
// Pure functions, so they run here in Node. The index and the dialog have their own tests below the core's.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { norm, words, tokens, prepare, rank, score, snippet } from '../assets/search/core.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

const R = (name, o = {}) => prepare({ name, names: '', kw: '', summary: '', text: '', ...o });

test('norm: case, width and accents do not matter', () => {
  assert.equal(norm('MicLevel'), 'miclevel');
  assert.equal(norm('ＭＩＣ'), 'mic');          // full-width Latin
  assert.equal(norm('Café'), 'café');
  assert.equal(norm(null), '');
});

test('words: a name is also its words', () => {
  assert.equal(words('micLevel'), 'mic level');
  assert.equal(words('OAVp5.mic.start'), 'oavp5 mic start', 'OAVp5 stays one word');
  assert.equal(words('option:mic'), 'option mic');
  assert.equal(words('startDrums'), 'start drums');
  assert.equal(words('HTMLElement'), 'html element');
});

test('tokens: every word of the query, folded', () => {
  assert.deepEqual(tokens('  Mic   LEVEL '), ['mic', 'level']);
  assert.deepEqual(tokens('麥克風 音量'), ['麥克風', '音量']);
  assert.deepEqual(tokens(''), []);
});

test('rank: an exact name beats a prefix beats a word inside beats the description', () => {
  const recs = [
    R('micLevel', { summary: 'How loud the microphone hears things' }),
    R('micSensitivity', { summary: 'Makes the microphone more sensitive' }),
    R('startMic', { summary: 'Turns the microphone on' }),
    R('beat', { summary: 'True for one frame when the microphone hears a beat', text: 'micLevel is related' }),
  ];
  assert.deepEqual(rank(recs, 'micLevel').map((x) => x.rec.name), ['micLevel', 'beat'], 'exact first; a mention in the text last');
  assert.deepEqual(rank(recs, 'mic').map((x) => x.rec.name).slice(0, 2), ['micLevel', 'micSensitivity'], 'prefix of the name beats the word inside (startMic)');
  assert.equal(rank(recs, 'mic')[2].rec.name, 'startMic');
  assert.deepEqual(rank(recs, 'level').map((x) => x.rec.name)[0], 'micLevel', 'a word of a camelCase name');
  assert.deepEqual(rank(recs, 'mic level').map((x) => x.rec.name)[0], 'micLevel', 'two words, both must match');
  assert.deepEqual(rank(recs, 'zzz'), []);
  assert.deepEqual(rank(recs, '   '), []);
});

test('rank: Chinese is a substring, with no word list; keywords bridge the two languages', () => {
  const recs = [
    R('micLevel', { kw: 'microphone volume 麥克風 音量 聲音大小', summary: '麥克風聽到的聲音有多大聲' }),
    R('noteName', { kw: 'note name 音名', summary: '把 MIDI 號碼轉成音名' }),
  ];
  assert.equal(rank(recs, '麥克風')[0].rec.name, 'micLevel');
  assert.equal(rank(recs, '麥克')[0].rec.name, 'micLevel', 'part of a word');
  assert.equal(rank(recs, '音名')[0].rec.name, 'noteName');
  assert.equal(rank(recs, 'microphone')[0].rec.name, 'micLevel', 'the English keyword');
  assert.deepEqual(rank(recs, '麥克風 音量').map((x) => x.rec.name), ['micLevel'], 'every word has to match');
});

test('rank: aliases and shared names (knob1 … knob8 is one entry)', () => {
  const recs = [R('knob1', { names: 'knob1 knob2 knob3 knob8' }), R('knob', { summary: 'the function form' })];
  assert.equal(rank(recs, 'knob3')[0].rec.name, 'knob1', 'an alias is an exact match');
  assert.equal(rank(recs, 'knob')[0].rec.name, 'knob', 'the exact name first');
});

test('snippet: a piece of text around the match, the match marked', () => {
  const text = 'It follows the browser animation frames rather than draw(), so a sketch at frameRate(10) still reads the latest value.';
  const parts = snippet(text, ['frames'], { before: 10, after: 20 });
  assert.ok(parts.some((p) => p.hit && p.text.toLowerCase() === 'frames'));
  assert.equal(parts[0].text, '…');
  assert.equal(snippet('', ['x']).length, 1);
  assert.match(snippet('麥克風聽到的聲音有多大聲', ['聲音'], { before: 2, after: 4 }).map((p) => p.text).join(''), /聲音/);
});

test('the reference dataset through the core: micLevel is first for its name, in the first five for the words people use', () => {
  const ds = JSON.parse(read('docs/reference/reference.json'));
  const recs = ds.entries.map((e) => prepare({
    name: e.name.replace(/^option:/, ''), names: [e.key, ...e.aliases].join(' '), kw: [...e.keywords.en, ...e.keywords.zh].join(' '),
    summary: e.summary ? `${e.summary.en} ${e.summary.zh}` : '', text: e.description.map((d) => `${d.en} ${d.zh}`).join(' '),
  }));
  const top = (q, n = 5) => rank(recs, q, { limit: n }).map((x) => x.rec.name);
  assert.equal(top('micLevel', 1)[0], 'micLevel');
  assert.equal(top('miclevel', 1)[0], 'micLevel', 'case does not matter');
  assert.ok(top('mic level').includes('micLevel'));
  assert.ok(top('麥克風').includes('micLevel'), '麥克風 finds micLevel');
  assert.ok(top('microphone').includes('micLevel'));
  assert.ok(top('音量').includes('micLevel'));
  assert.equal(top('startMic', 1)[0], 'startMic');
  assert.equal(top('knob3', 1)[0], 'knob1', 'knob3 is covered by the knob1 entry');
  assert.ok(score(recs.find((r) => r.name === 'micLevel'), tokens('loudness')) > 0, 'loudness (a keyword)');
});
