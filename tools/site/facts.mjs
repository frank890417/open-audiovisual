// The site's numbers, computed from the repository — never typed by hand.
//
//   import { getFacts, enWords, zhWords } from '../site/facts.mjs';
//   const f = getFacts();   // f.packageCount, f.exampleCount, f.controllerCount, f.nextExampleNumber …
//
// The homepage, llms.txt, llms-full.txt and (through `readmeBlock()`) the README read these instead of
// writing "twenty-one packages" into prose that goes stale the day the twenty-second lands.
// Everything is derived from the file system and the controller profiles at build time, so a number on the
// site can only be wrong if the repository is.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { catalog } from '../controllers/page.mjs';
import { CHAPTERS } from '../docs/chapters.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const dirs = (rel) => fs.readdirSync(path.join(ROOT, rel), { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name).sort();

/** examples/NN-name/ with an index.html, in number order. */
export function listExamples() {
  return dirs('examples')
    .filter((d) => /^\d\d-/.test(d) && fs.existsSync(path.join(ROOT, 'examples', d, 'index.html')))
    .map((id) => ({ id, num: Number(id.slice(0, 2)) }));
}

/** Test cases, counted from the source (test( / it( at the start of a line): a floor that needs no test run. */
function countTests() {
  const files = fs.readdirSync(path.join(ROOT, 'tests')).filter((f) => f.endsWith('.test.js'));
  let cases = 0;
  for (const f of files) cases += (fs.readFileSync(path.join(ROOT, 'tests', f), 'utf8').match(/^\s*(?:test|it)\(/gm) || []).length;
  return { files: files.length, cases };
}

let memo = null;
export function getFacts({ fresh = false } = {}) {
  if (memo && !fresh) return memo;
  const examples = listExamples();
  const nextNum = Math.max(0, ...examples.map((e) => e.num)) + 1;
  const packages = dirs('packages').filter((d) => fs.existsSync(path.join(ROOT, 'packages', d, 'package.json')));
  const cat = catalog();
  const tests = countTests();
  memo = {
    version: JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8')).version,
    examples,
    exampleCount: examples.length,
    nextExampleNumber: String(nextNum).padStart(2, '0'),
    packages,
    packageCount: packages.length,
    controllerCount: cat.all.length,         // every profile: one page each, in both languages
    deviceCount: cat.devices.length,         // real hardware
    genericCount: cat.generic.length,        // generic layouts (keys 25/49/61, 8 faders, 16 pads, …)
    controlCount: cat.stats.controls,        // controls on real devices (a keybed counts every key)
    brands: [...new Set(cat.devices.map((d) => d.p.maker).filter(Boolean))],
    docChapters: CHAPTERS.length,
    testFiles: tests.files,
    testCount: tests.cases,
  };
  return memo;
}

// ---------------------------------------------------------------------------- numbers as words
const ONES = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];
const TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];
/** 23 → "twenty-three" (0–99; beyond that, digits). */
export function enWords(n) {
  if (n < 20) return ONES[n];
  if (n < 100) return TENS[Math.floor(n / 10)] + (n % 10 ? '-' + ONES[n % 10] : '');
  return String(n);
}
export const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

const ZH = ['零', '一', '二', '三', '四', '五', '六', '七', '八', '九'];
/** 23 → "二十三" (0–99; beyond that, digits). */
export function zhWords(n) {
  if (n < 10) return ZH[n];
  if (n < 20) return '十' + (n % 10 ? ZH[n % 10] : '');
  if (n < 100) return ZH[Math.floor(n / 10)] + '十' + (n % 10 ? ZH[n % 10] : '');
  return String(n);
}

// ---------------------------------------------------------------------------- README marker block
export const README_MARK = ['<!-- facts:start (written by tools/build-examples.mjs) -->', '<!-- facts:end -->'];

/** The lines the README can carry between README_MARK, so its numbers come from here too. */
export function readmeBlock(f = getFacts()) {
  return [
    `${f.packageCount} packages · ${f.exampleCount} examples · ${f.controllerCount} MIDI controller profiles `
      + `(${f.deviceCount} devices, ${f.genericCount} generic layouts, ${f.controlCount} controls) · ${f.testCount} tests`,
  ].join('\n');
}

/**
 * Named blocks: every <!--gen:NAME-->…<!--/gen:NAME--> in the text gets blocks[NAME] between its markers (inline or
 * multi-line). A marker pair with no value in `blocks` is left alone, and so is text without markers.
 */
export function applyBlocks(text, blocks) {
  return text.replace(/<!--gen:([\w-]+)-->([\s\S]*?)<!--\/gen:\1-->/g, (m, name, cur) => {
    if (!(name in blocks)) return m;
    const val = String(blocks[name]);
    // a multi-line block sits on its own lines; an inline one hugs its markers
    return val.includes('\n') ? `<!--gen:${name}-->\n${val}\n<!--/gen:${name}-->` : `<!--gen:${name}-->${val}<!--/gen:${name}-->`;
  });
}

/** README text with the block between the markers replaced (unchanged when the markers are absent). */
export function applyReadmeBlock(text, f = getFacts()) {
  const i = text.indexOf(README_MARK[0]), j = text.indexOf(README_MARK[1]);
  if (i < 0 || j < i) return text;
  return text.slice(0, i + README_MARK[0].length) + '\n' + readmeBlock(f) + '\n' + text.slice(j);
}
