// A page's meta description made of the page's own words: the opening sentences of its text, as many as fit. No new prose.
// tools/build-docs.mjs describes a chapter with it (its first paragraphs), tools/reference/name-page.mjs a name (its summary,
// then its description when the summary alone is short).
//
//   describe(['First paragraph.', 'Second one.'], 'en', { min: 70, max: 160 })
//
// A sentence ends at . ! ? before a space in English (so p5.js stays whole), at 。！？ in Chinese; a closing quote or bracket
// stays with it. A later paragraph's lead-in to a list ("… these three:") is skipped. Too short: the next sentence joins.
// Too long: the sentences that fit, or one long sentence cut at a word (en) or after a comma (zh), with …

/** Sentences of one paragraph of plain text. */
export const sentences = (p, locale) => (locale === 'zh' ? p.match(/[^。！？]+(?:[。！？]+[」』）"]*|$)/g) : p.match(/.+?(?:[.!?]+["'”)\]]*(?=\s)|$)/g) || []).map((x) => x.trim()).filter(Boolean);
/** A sentence that hands over to a list or a code block ("… at the top:") ends with … when it is the last one shown. */
export const closing = (s) => s.replace(/[:：]$/, '…');
/** Cut text to at most n characters at a word (en) or after a comma (zh), then … */
export const cut = (text, n, locale) => {
  const head = text.slice(0, n);
  const at = locale === 'zh' ? Math.max(head.lastIndexOf('，'), head.lastIndexOf('、')) : head.lastIndexOf(' ');
  return (at > n / 2 ? head.slice(0, at) : head).replace(/[\s,，、:：;]+$/, '') + '…';
};

/** The description: paragraphs (plain text, in order) → at least `min` characters when the text has them, at most `max`. */
export function describe(paragraphs, locale, { min, max }) {
  const sep = locale === 'zh' ? '' : ' ';
  let out = '';
  for (const p of paragraphs) {
    for (const s of sentences(p, locale)) {
      if (out && /[:：]$/.test(s)) continue;   // a later paragraph's lead-in to a list says nothing on its own
      const next = out ? out + sep + s : s;
      if (next.length <= max) { out = next; if (out.length >= min) return closing(out); continue; }
      return out.length >= min ? closing(out) : cut(next, max - 1, locale);
    }
  }
  return closing(out);
}

/** The Markdown an entry's text may hold ([text](#link), `code`, **bold**, a ```fence```) as plain words. */
export const mdText = (t) => String(t || '').replace(/```[\s\S]*?```/g, ' ').replace(/\[([^\]]+)\]\([^)]*\)/g, '$1').replace(/[`*]|__/g, '').replace(/\s+/g, ' ').trim();
