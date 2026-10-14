// One-line copy for every example, for llms.txt (English and Traditional Chinese).
//
// The copy is the catalog's (examples/catalog.json, read through tools/examples/catalog.mjs): the homepage blurb
// of each example, as plain text. An example that is not in the catalog still appears in llms.txt: its line is
// taken from the first comment of its main.js, the same line the MCP server's list_examples prints.
// tests/site.test.js fails when an example is missing from llms.txt; tests/examples-catalog.test.js when it
// is missing from the catalog.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { byId, L, plainText } from '../examples/catalog.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

/** "NN · title — summary." from the first comment line of examples/<id>/main.js, '' when there is none. */
function firstComment(id) {
  try {
    const first = fs.readFileSync(path.join(ROOT, 'examples', id, 'main.js'), 'utf8').split('\n')[0];
    const m = /^\/\/\s*\d+\s*·\s*(.+)$/.exec(first);
    return m ? m[1].replace(/\s+—\s+/, ': ').replace(/\.$/, '') + '.' : '';
  } catch { return ''; }
}

/** The one-liner for an example in a language. */
export function exampleLine(id, locale) {
  const e = byId.get(id);
  if (e) return `${plainText(L(e.summary, locale))} ${locale === 'zh' ? `（${plainText(L(e.plays, locale))}）` : `(plays with ${plainText(L(e.plays, locale))})`}`.replace(/\s+/g, ' ');
  return firstComment(id) || id;
}
