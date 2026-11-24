// The "next step" block at the end of a page's main content: a few links on, small, in the site's frame
// (assets/home/home.css, .next-step). Every link carries data-oav-event="next_step" data-oav-to="…", which
// assets/track.js counts as oav_next_step; a link off the site carries data-oav-link instead (oav_outbound).
//
//   nextLink(href, to, html)                 one link on (to: one of the NEXT_TO words in assets/track.js)
//   usesBlock({ c, locale, home, title, groups })   "examples that use these names", one row per group, then Made with
//
// The words come from the caller's string table and the homepage tables (home.next, home.footer), so the block has no
// strings of its own.

import { esc, attr } from './chrome.mjs';
import { L } from '../examples/catalog.mjs';

/** One link on, counted as oav_next_step. `html` is trusted markup from a string table. */
export const nextLink = (href, to, html, cls = 'more') => `<a${cls ? ` class="${cls}"` : ''} href="${attr(href)}" data-oav-event="next_step" data-oav-to="${to}">${html}</a>`;

/** An example as a link: its number and its title in this language. */
export const exampleLink = (c, e, locale, cls = '') => nextLink(`${c.root}${e.dir}`, 'example', `<span class="next-n">${e.num}</span> ${esc(L(e.title, locale))}`, cls);

/** The Made with line every next-step block can end with: the label and the sentence the /made-with/ page already uses. */
export const madeWithLine = (c, home) => `<p class="next-made">${nextLink(c.to('made'), 'made_with', `${esc(home.footer.made)} →`)} <span>${esc(home.next.made)}</span></p>`;

/**
 * "Examples that use these names": groups = [{ label, examples }] (catalog entries), a group without one is left out.
 * The heading id is next-step-title; the block sits outside anything a page's script filters or reorders.
 */
export function usesBlock({ c, locale, home, title, groups }) {
  const rows = groups.filter((g) => g.examples.length).map((g) => `<div><dt>${esc(g.label)}</dt><dd>${g.examples.map((e) => exampleLink(c, e, locale)).join('')}</dd></div>`);
  return `<nav class="next-step" aria-labelledby="next-step-title">
      <p class="eyebrow">${esc(home.next.label)}</p>
      <h2 id="next-step-title">${esc(title)}</h2>
      ${rows.length ? `<dl class="next-groups">
        ${rows.join('\n        ')}
      </dl>` : ''}
      ${madeWithLine(c, home)}
    </nav>`;
}
