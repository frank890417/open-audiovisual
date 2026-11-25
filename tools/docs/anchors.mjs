// Where every handbook heading lives: one page per chapter (/docs/<chapter>/, /zh/docs/<chapter>/), and the anchor of
// every heading → the chapter page that carries it. The one place the handbook's addresses are decided, so the docs
// generator, the top bar's `c.to('docs', '#…')` (tools/site/chrome.mjs), the search index, llms.txt and the forwarder on
// /docs/ cannot disagree.
//
//   chapterPath('mapping')           'docs/mapping/'   (under the site root, no "zh/")
//   chapterPath('p5')                'p5/'             the p5 chapter IS /p5/: tools/build-examples.mjs renders the same
//                                                      Markdown there, so a second copy under /docs/p5/ would be the same
//                                                      page twice (/docs/p5/ is a noindex stub that forwards to /p5/)
//   chapterOfAnchor('mapping-curves')  'mapping'       from the real headings, not from the prefix
//   docsHref(root, 'zh', 'mapping-curves')  '../zh/docs/mapping/#mapping-curves'   (null: no heading has that id)
//   rewriteDocsUrl('https://openaudiovisual.com/docs/#mapping')  'https://openaudiovisual.com/docs/mapping/'
//
// The anchors are the English headings' ids, rendered exactly as /docs/ rendered them when it was one page (one `used` set
// across every chapter, in order, after 'top', 'main' and 'toc'), so every #anchor anyone ever linked to keeps its id;
// the zh pages take the same ids (tests/docs.test.js holds them in step). A leaf module: chapters, markdown, the docs strings, fs.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { CHAPTERS } from './chapters.mjs';
import { renderMarkdown } from './markdown.mjs';
import en from './en.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const SITE = 'https://openaudiovisual.com/';
/** Ids a page already uses before the first chapter (the old one-page layout's frame). */
export const FRAME_IDS = ['top', 'main', 'toc'];
/** The chapter whose page is /p5/ (tools/build-examples.mjs renderP5), not /docs/p5/. */
export const P5_CHAPTER = 'p5';
/** Folders under docs/ that are not chapters: a chapter id may never be one of these. */
export const RESERVED = ['reference', 'cheatsheet', 'design', 'evolve', 'zh'];

/** The page a chapter lives on, under the site root without "zh/". */
export const chapterPath = (id) => (id === P5_CHAPTER ? 'p5/' : `docs/${id}/`);
/** The chapters that get a page under /docs/ (every one but the p5 chapter). */
export const DOC_PAGES = CHAPTERS.filter((ch) => ch.id !== P5_CHAPTER);

let heads = null;
/** chapter id → the English headings ({ id, mdLevel, text, … }), ids exactly as the handbook renders them. */
export function englishHeadings() {
  if (heads) return heads;
  const used = new Set(FRAME_IDS);
  heads = new Map();
  for (const ch of CHAPTERS) {
    let md = null;
    try { md = fs.readFileSync(path.join(ROOT, ch.en), 'utf8'); } catch { md = (ch.external && en.placeholder[ch.id]) || null; }   // the same fallback tools/build-docs.mjs reads
    if (md === null) throw new Error(`docs: chapter "${ch.id}" has no source (${ch.en})`);
    heads.set(ch.id, renderMarkdown(md, { idPrefix: ch.id, shift: 1, used }).headings);
  }
  return heads;
}

let map = null;
/** anchor → chapter id, for every heading of every chapter. */
export function anchorMap() {
  if (map) return map;
  map = new Map();
  for (const [id, hs] of englishHeadings()) { map.set(id, id); for (const h of hs) map.set(h.id, id); }
  return map;
}
export const chapterOfAnchor = (anchor) => anchorMap().get(anchor) || null;

/** The href of a heading from a page whose path back to the site root is `root`, in `locale`; null when no heading has that id. */
export function docsHref(root, locale, anchor) {
  const ch = chapterOfAnchor(anchor);
  if (!ch) return null;
  return root + (locale === 'zh' ? 'zh/' : '') + chapterPath(ch) + (anchor === ch ? '' : '#' + anchor);
}

/** An address written as /docs/#anchor (absolute, or from the root, either language) → the chapter page; anything else unchanged. */
export function rewriteDocsUrl(href) {
  const m = /^(https:\/\/openaudiovisual\.com)?\/(zh\/)?docs\/#([^\s#]+)$/.exec(String(href));
  if (!m) return href;
  const ch = chapterOfAnchor(decodeURIComponent(m[3]));
  if (!ch) return href;
  return (m[1] ? SITE : '/') + (m[2] || '') + chapterPath(ch) + (m[3] === ch ? '' : '#' + m[3]);
}

/**
 * The forwarder /docs/ carries in its <head>: an old link /docs/#mapping-curves (from another site, a bookmark, a chat) is sent
 * to /docs/mapping/#mapping-curves before anything is drawn. The table is exact (every heading id, grouped by chapter: a suffix
 * after "<chapter>-", or "=" + the whole id when it does not start that way); an id it does not know that starts with a chapter's
 * name goes to that chapter's page. `top`, `main` and `toc` stay on /docs/. Pages are relative to /docs/ (or /zh/docs/).
 */
export function forwarderScript() {
  const groups = CHAPTERS.map((ch) => {
    const own = englishHeadings().get(ch.id).filter((h) => h.id !== ch.id).map((h) => (h.id.startsWith(ch.id + '-') ? h.id.slice(ch.id.length + 1) : '=' + h.id));
    return [ch.id, ch.id === P5_CHAPTER ? '../p5/' : ch.id + '/', own];
  });
  const G = JSON.stringify(groups).replace(/</g, '\\u003c');
  return `(function(){var G=${G},h=location.hash.slice(1),i,j,g,b=null;if(!h)return;try{h=decodeURIComponent(h)}catch(e){}`
    + `for(i=0;i<G.length;i++){g=G[i];if(h===g[0])return location.replace(g[1]);for(j=0;j<g[2].length;j++){var s=g[2][j];if((s.charAt(0)==='='?s.slice(1):g[0]+'-'+s)===h)return location.replace(g[1]+'#'+h)}}`
    + `for(i=0;i<G.length;i++)if(h.indexOf(G[i][0]+'-')===0&&(!b||G[i][0].length>b[0].length))b=G[i];if(b)location.replace(b[1]+'#'+h)})();`;
}
