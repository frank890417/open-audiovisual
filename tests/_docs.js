// Shared by the tests that link into the handbook: where a heading lives now that every chapter has its own page
// (tools/docs/anchors.mjs), and whether a link from a page lands on a heading that exists.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chapterOfAnchor, chapterPath } from '../tools/docs/anchors.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/** The repo-relative file of the page that carries a handbook heading, in one language (null: no heading has that id). */
export function chapterFileOf(id, lang) {
  const ch = chapterOfAnchor(id);
  return ch ? (lang === 'zh' ? 'zh/' : '') + chapterPath(ch) + 'index.html' : null;
}

/** The html of the page that carries a handbook heading ('' when there is none). */
export const pageWith = (id, lang) => { const f = chapterFileOf(id, lang); return f && fs.existsSync(path.join(ROOT, f)) ? fs.readFileSync(path.join(ROOT, f), 'utf8') : ''; };

/** The href the generators write for a handbook heading, from a page whose way back to the root is `root`. */
export const docsLinkFrom = (root, id, lang) => { const ch = chapterOfAnchor(id); return root + (lang === 'zh' ? 'zh/' : '') + chapterPath(ch) + (id === ch ? '' : '#' + id); };

/** A relative link from a file (repo-relative) → { file, frag, ok }: the page exists and, with a fragment, carries that id. */
export function landing(fromRel, href) {
  const [p, frag] = href.split('#');
  let rel = path.posix.normalize(path.posix.join(path.posix.dirname(fromRel), p));
  if (p === '' ) rel = fromRel;
  else if (p.endsWith('/') || rel === '.') rel = path.posix.join(rel, 'index.html');
  const abs = path.join(ROOT, rel);
  const html = fs.existsSync(abs) ? fs.readFileSync(abs, 'utf8') : null;
  return { file: rel, frag, ok: html !== null && (!frag || html.includes(`id="${frag}"`)) };
}
