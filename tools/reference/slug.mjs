// Where each oav-p5 name has its own page: /docs/reference/<slug>/ and /zh/docs/reference/<slug>/ (tools/build-reference.mjs).
// The names of p5/oav-p5.js only: its globals, callbacks, OAVp5.* members and loader options, the names with runnable sketches.
// The package exports stay on the one reference page (/docs/reference/#<id>), which is also the index of the names.
//
//   nameSlug('micLevel')          'mic-level'
//   nameSlug('OAVp5.mic.level')   'oavp5-mic-level'
//   nameSlug('option-clock')      'option-clock'        (an option's anchor id; the option is ?oav_clock=)
//   nameSlug('fader1')            'fader1'              (fader2 … fader8 are aliases: they are on fader1's page)
//
// The slug is read off the record's anchor id (tools/reference/model.mjs), lowercase, words joined by "-", so it only changes
// when the name does. Two names with one slug is an error (slugProblems), never a quiet "-2".
//
// refHref() is what `c.to('reference', '#micLevel')` (tools/site/chrome.mjs) answers: the name's page when it has one. It reads
// docs/reference/reference.json, the dataset tools/build-reference.mjs writes, the same way /p5/'s cheat sheet does. A leaf module.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
export const P5_PACKAGE = 'oav-p5';
export const NAME_BASE = 'docs/reference/';

/** An anchor id → the slug of its page: camelCase split, dots and colons as dashes, lowercase. */
export const nameSlug = (id) => String(id).replace(/\bOAVp5\b/g, 'oavp5')   // one word, not O-A-Vp5
  .replace(/([a-z0-9])([A-Z])/g, '$1-$2').replace(/([A-Z]+)([A-Z][a-z])/g, '$1-$2')
  .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

/** The page of a name, under the site root without "zh/". */
export const namePath = (id) => `${NAME_BASE}${nameSlug(id)}/`;

/** The ids that would share a page: [[slug, [id, id]], …] (empty when every name has its own). */
export function slugProblems(ids) {
  const by = new Map();
  for (const id of ids) { const s = nameSlug(id); if (!by.has(s)) by.set(s, []); by.get(s).push(id); }
  const bad = [...by].filter(([s, list]) => list.length > 1 || !s);
  return bad;
}

let anchors = null;
/** anchor (a name's id, or one of its aliases' ids) → { id, slug } for every oav-p5 name in the committed dataset. */
export function nameAnchors() {
  if (anchors) return anchors;
  anchors = new Map();
  let ds = null;
  try { ds = JSON.parse(fs.readFileSync(path.join(ROOT, NAME_BASE, 'reference.json'), 'utf8')); } catch { return anchors; }   // not built yet
  for (const e of ds.entries) {
    if (e.package !== P5_PACKAGE || !e.documented) continue;
    const page = { id: e.id, slug: nameSlug(e.id) };
    anchors.set(e.id, page);
    for (const a of e.aliases) anchors.set(a.startsWith('option:') ? 'option-' + a.slice(7) : a, page);
  }
  return anchors;
}

/** Every name with a page, in the dataset's order: [{ id, slug }]. */
export function namePages() {
  const seen = new Set(), out = [];
  for (const p of nameAnchors().values()) if (!seen.has(p.id)) { seen.add(p.id); out.push(p); }
  return out;
}

/** The href of a name's page (with #alias when the anchor is an alias) from a page whose way back to the root is `root`; null when it has none. */
export function refHref(root, locale, anchor) {
  const p = nameAnchors().get(anchor);
  if (!p) return null;
  return root + (locale === 'zh' ? 'zh/' : '') + NAME_BASE + p.slug + '/' + (anchor === p.id ? '' : '#' + anchor);
}
