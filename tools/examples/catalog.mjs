// The one list of the examples: examples/catalog.json, read here and nowhere else.
//
//   import { EXAMPLES, ROUTES, byId, routeGroups, L, exampleUrl, plainText } from '../examples/catalog.mjs';
//
// The homepage's works section, /examples/ and /zh/examples/, every example page's static description and guide
// card, the README's example grid, llms.txt and the sitemap all read this file. To add an example: make the
// folder, add one object to catalog.json, run `node tools/build-examples.mjs` (and build-home, for the homepage).
//
// Entry shape (en/zh pairs are { en, zh }):
//   id, num, dir, route            the folder, its number, one of ROUTES
//   title, teaches, summary        the name; the ONE thing the page teaches (plain text); the homepage blurb (may hold <code>)
//   plays                          "plays with …" as shown on cards
//   needs, standIn                 input tags (see strings.mjs TAGS): what the work is about / what stands in without hardware
//   guide                          false → the page explains itself (15): only the head and the next link are generated
//   p5Line                         true → the guide card carries the "take this input into your own p5 sketch: one line" row
//   sketch                         a p5 one-line example (16–26): the p5/examples/<name>/sketch.js the page runs; build-examples
//                                  copies it to <dir>sketch.js, so the page, the handbook and the course run one file
//   thumb, alt                     800×500 webp under assets/home/works/, and its alt text
//   docs                           [{ id, en, zh }]: handbook anchors (/docs/#id), labels copied from the headings
//   tryThree                       { en: [3], zh: [3] }
//   read                           [{ file, from, to, match, note }]: lines to read; `match` is the start of line `from`
//                                  (tests/examples-catalog.test.js fails when a range drifts)
//   next                           the next example in the path (null at the end), `credit`: artwork credit (05–07, 02)

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SITE, REPO, BLOB, TREE } from '../site/chrome.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
export const CATALOG_FILE = 'examples/catalog.json';
const raw = JSON.parse(fs.readFileSync(path.join(ROOT, CATALOG_FILE), 'utf8'));

export const ROUTES = raw.routes;
export const EXAMPLES = raw.examples;
export const byId = new Map(EXAMPLES.map((e) => [e.id, e]));

/** { en, zh } → one language. */
export const L = (v, locale) => v[locale === 'zh' ? 'zh' : 'en'];
/** HTML (a blurb with <code>) → plain text. */
export const plainText = (html) => String(html).replace(/<[^>]+>/g, '').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');

/** The examples of each route, in path order: [{ route, items }]. */
export const routeGroups = () => ROUTES.map((route) => ({ route, items: EXAMPLES.filter((e) => e.route === route) }));

/** An example is one page, in English; the zh index and the guide card link to it. */
export const exampleUrl = (id) => `${SITE}examples/${id}/`;
export const sourceUrl = (e) => `${TREE}${e.dir.replace(/\/$/, '')}`;
export const lineUrl = (e, r) => `${BLOB}${e.dir}${r.file}#L${r.from}${r.to > r.from ? `-L${r.to}` : ''}`;
export { SITE, REPO };

/** The example after this one on the path, or null. */
export const nextOf = (e) => (e.next ? byId.get(e.next) : null);

/** Walk the chain from the first example; throws on a loop or a gap. Returns the ids in order. */
export function chain() {
  const out = [];
  let e = EXAMPLES.find((x) => !EXAMPLES.some((y) => y.next === x.id));
  while (e) {
    if (out.includes(e.id)) throw new Error('catalog: the next-chain loops at ' + e.id);
    out.push(e.id);
    e = nextOf(e);
  }
  return out;
}
