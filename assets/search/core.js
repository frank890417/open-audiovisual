// open-audiovisual search core — the matching and ranking every search on the site shares (the reference page's box,
// the nav's search dialog). Pure functions, no DOM: tests/search.test.js runs them in Node.
//
// How a query meets a record (all the words must match somewhere; the best field of each word counts):
//   · case, width and accents do not matter ("MICLEVEL" finds micLevel; full-width letters fold with NFKC)
//   · Chinese is never split into words: a Chinese word is searched as a substring, which is what makes "麥克風" find every
//     record that says 麥克風, with no dictionary and no segmentation to get wrong
//   · a name is also its words: micLevel is "mic level", midi.play is "midi play", so "level" and "mic level" find micLevel
//   · every record can carry keywords in both languages, so the English word "microphone" and the Chinese 麥克風 meet
//     the same entry from either side of the language switch
// A record: { name, names?, kw?, title?, summary?, text? } (strings; names and kw are space-separated lists).

/** Fold a string for matching. */
export const norm = (s) => String(s == null ? '' : s).normalize('NFKC').toLowerCase();

/** micLevel → "mic level"; OAVp5.mic.start → "oavp5 mic start"; option:mic → "option mic". */
export const words = (name) => norm(String(name == null ? '' : name).replace(/OAVp5/g, 'oavp5').replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2').replace(/[._:/@-]+/g, ' '));

/** The query as the words that all have to match. */
export const tokens = (q) => norm(q).split(/\s+/).filter(Boolean);

/** Fold every field of a record once, so ranking a thousand records is a thousand substring checks. */
export function prepare(r) {
  const names = String(r.names || '');
  return Object.assign({}, r, {
    _name: norm(r.name), _names: norm(names), _words: [words(r.name), ...names.split(/\s+/).filter(Boolean).map(words)].join(' | '),
    _kw: norm(r.kw), _title: norm(r.title || ''), _summary: norm(r.summary || ''), _text: norm(r.text || ''),
  });
}

/** Points of one word against one prepared record; 0 = no match. */
export function wordScore(rec, w) {
  if (rec._name === w) return 1000;
  if (rec._names && (` ${rec._names} `).includes(` ${w} `)) return 900;
  if (rec._name.startsWith(w)) return 700;
  if (rec._words.split(' | ').some((x) => x.split(' ').some((y) => y.startsWith(w)))) return 500;
  if (rec._name.includes(w)) return 400;
  if (rec._names.includes(w)) return 300;
  if (rec._title.includes(w)) return 260;
  if (rec._words.includes(w)) return 250;
  if (rec._kw.includes(w)) return 200;
  if (rec._summary.includes(w)) return 120;
  if (rec._text.includes(w)) return 50;
  return 0;
}

/** Total points of a query against a prepared record; 0 if any word does not match. */
export function score(rec, toks) {
  let total = 0;
  for (const w of toks) { const s = wordScore(rec, w); if (!s) return 0; total += s; }
  return total;
}

/** Rank prepared records for a query: [{ rec, score }] best first, ties by shorter name, then alphabetically. */
export function rank(recs, q, { limit = Infinity, boost } = {}) {
  const toks = tokens(q);
  if (!toks.length) return [];
  const out = [];
  for (const rec of recs) {
    let s = score(rec, toks);
    if (!s) continue;
    if (boost) s += boost(rec) || 0;
    out.push({ rec, score: s });
  }
  out.sort((a, b) => b.score - a.score || String(a.rec.name).length - String(b.rec.name).length || String(a.rec.name).localeCompare(String(b.rec.name)));
  return out.slice(0, limit);
}

/** A short piece of `text` around the first match of any word, with the matches marked: [{ text, hit }] (for a result's snippet). */
export function snippet(text, toks, { before = 36, after = 90 } = {}) {
  const raw = String(text || '').replace(/\s+/g, ' ').trim();
  const low = norm(raw);
  let at = -1, len = 0;
  for (const w of toks) { const i = low.indexOf(w); if (i >= 0 && (at < 0 || i < at)) { at = i; len = w.length; } }
  if (at < 0) return [{ text: raw.slice(0, before + after), hit: false }];
  const from = Math.max(0, at - before), to = Math.min(raw.length, at + len + after);
  const piece = raw.slice(from, to);
  const pl = norm(piece);
  const marks = [];
  for (const w of toks) { let i = 0; while ((i = pl.indexOf(w, i)) >= 0) { marks.push([i, i + w.length]); i += w.length; } }
  marks.sort((a, b) => a[0] - b[0]);
  const merged = [];
  for (const m of marks) { const last = merged[merged.length - 1]; if (last && m[0] <= last[1]) last[1] = Math.max(last[1], m[1]); else merged.push([...m]); }
  const parts = [];
  let pos = 0;
  if (from > 0) parts.push({ text: '…', hit: false });
  for (const [a, b] of merged) { if (a > pos) parts.push({ text: piece.slice(pos, a), hit: false }); parts.push({ text: piece.slice(a, b), hit: true }); pos = b; }
  if (pos < piece.length) parts.push({ text: piece.slice(pos), hit: false });
  if (to < raw.length) parts.push({ text: '…', hit: false });
  return parts;
}
