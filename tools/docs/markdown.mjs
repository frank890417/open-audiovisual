// A small, zero-dependency Markdown renderer for the docs pages.
//
// Why not a library: the framework has no dependencies and the site builds with
// plain `node`. The docs use a known, modest subset of GitHub-flavoured
// Markdown, so ~400 lines cover it and every rule is unit-tested
// (tests/docs.test.js). Everything is escaped; raw HTML in the source renders
// as text (only <kbd>…</kbd> passes through).
//
// Supported: ATX headings (with optional `{#id}`), paragraphs, **strong**,
// *em*, _em_, `code`, ``co`de``, [links](href "title"), <autolinks>, images,
// hard breaks (two trailing spaces or a trailing backslash), backslash escapes,
// ordered/unordered lists (nested by indentation, lazy continuation lines,
// task items `- [ ]` / `- [x]`), GFM tables (alignment, `\|` in cells), fenced
// code (``` or ~~~, with a language), blockquotes (nested Markdown) with
// GitHub alerts (`> [!NOTE]`, TIP, IMPORTANT, WARNING, CAUTION), and `---`.
//
//   const { html, headings } = renderMarkdown(src, {
//     idPrefix: 'mapping',          // `## Curves` → id "mapping-curves"; `# Title` → id "mapping"
//     shift: 1,                     // `#` → <h2>, `##` → <h3> …
//     twin: [{ level, id }],        // positional ids from the other language (zh takes en's ids)
//     used: new Set(),              // ids already on the page (kept unique page-wide)
//     resolveLink: (href) => href,  // rewrite links (docs .md → #anchor, code → GitHub)
//     labels: { note: 'Note', … },  // alert titles
//     anchorLabel: 'Link to this section',
//   });

export const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
export const attr = (s) => esc(s).replace(/"/g, '&quot;');

/** ASCII slug: lowercase, alphanumerics joined by '-'. Non-ASCII text yields '' (callers fall back). */
export function slugify(text) {
  return String(text)
    .replace(/`/g, '')
    .replace(/<[^>]*>/g, '')
    .toLowerCase()
    .replace(/&[a-z]+;/g, ' ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

// ───────────────────────── syntax highlighting ─────────────────────────
// Deliberately tiny (same classes as the homepage: .tc comment, .ts string,
// .tk keyword). Escapes as it goes.

const JS_KW = new Set(['import', 'from', 'export', 'default', 'const', 'let', 'var', 'await', 'async', 'return',
  'this', 'new', 'function', 'class', 'extends', 'if', 'else', 'for', 'of', 'in', 'while', 'switch', 'case',
  'break', 'continue', 'try', 'catch', 'finally', 'throw', 'typeof', 'null', 'undefined', 'true', 'false', 'static', 'get', 'set']);
const SH_KW = new Set(['cd', 'node', 'npm', 'npx', 'git', 'export', 'curl', 'open']);

export function highlight(code, lang = '') {
  const l = String(lang).toLowerCase();
  if (['js', 'javascript', 'mjs', 'ts', 'jsx'].includes(l)) return hlWith(code, /(\/\/[^\n]*|\/\*[\s\S]*?\*\/)|('(?:[^'\\\n]|\\.)*'|"(?:[^"\\\n]|\\.)*"|`(?:[^`\\]|\\.)*`)|\b([A-Za-z_$][\w$]*)\b/g, JS_KW, true);
  if (['json', 'jsonc'].includes(l)) return hlWith(code, /(\/\/[^\n]*)|("(?:[^"\\\n]|\\.)*")|\b(true|false|null)\b/g, new Set(['true', 'false', 'null']), true);
  if (['bash', 'sh', 'shell', 'zsh', 'console'].includes(l)) return hlWith(code, /(#[^\n]*)|('(?:[^'\\\n]|\\.)*'|"(?:[^"\\\n]|\\.)*")|\b([A-Za-z_][\w-]*)\b/g, SH_KW, false, true);
  if (['html', 'xml', 'svg'].includes(l)) return hlWith(code, /(<!--[\s\S]*?-->)|("[^"\n]*")|<\/?([A-Za-z][\w-]*)/g, null, false, false, true);
  return esc(code);
}

function hlWith(code, re, kw, slashComments, hashComments = false, tags = false) {
  let out = '', i = 0, m;
  re.lastIndex = 0;
  while ((m = re.exec(code))) {
    out += esc(code.slice(i, m.index));
    if (m[1]) {
      // a '#' or '//' comment starts after whitespace or at line start, never mid-token (https://, '#000')
      const prev = m.index ? code[m.index - 1] : '\n';
      if ((hashComments || (slashComments && m[1].startsWith('//'))) && !/\s/.test(prev)) {
        out += esc(m[1][0]); re.lastIndex = m.index + 1; i = m.index + 1; continue;
      }
      out += `<span class="tc">${esc(m[1])}</span>`;
    } else if (m[2]) out += `<span class="ts">${esc(m[2])}</span>`;
    else if (tags) out += esc(m[0].slice(0, m[0].length - m[3].length)) + `<span class="tk">${esc(m[3])}</span>`;
    else if (kw && kw.has(m[3])) out += `<span class="tk">${esc(m[3])}</span>`;
    else out += esc(m[3]);
    i = re.lastIndex;
  }
  return out + esc(code.slice(i));
}

// ───────────────────────── inline ─────────────────────────

const PH = '\u0000';   // placeholder delimiter: never present in source text
// CJK ideographs, kana, full-width punctuation and forms
const CJK = '\\u2e80-\\u2fff\\u3000-\\u30ff\\u3400-\\u9fff\\uf900-\\ufaff\\ufe30-\\ufe4f\\uff00-\\uffef';
const CJK_BREAK = new RegExp(`([${CJK}]) ?\\n[ \\t]*([${CJK}])`, 'g');   // (two trailing spaces stay a hard break)

/**
 * Inline Markdown → HTML. `ctx.resolveLink(href)` rewrites hrefs.
 * Order: code spans, escapes, autolinks, images, links (recursive), <kbd>, then
 * emphasis on the escaped remainder.
 */
export function inline(src, ctx = {}, slots = []) {
  // `slots` is shared with recursive calls (a link's text), so placeholders made
  // outside a link still resolve inside it
  const put = (html) => `${PH}${slots.push(html) - 1}${PH}`;
  // a soft line break between two CJK characters joins them: browsers would render it as a space
  let s = String(src).replace(CJK_BREAK, '$1$2');

  // code spans: a run of N backticks closes on the next run of exactly N
  s = s.replace(/(`+)([\s\S]*?[^`])\1(?!`)/g, (m, ticks, body) => {
    let b = body.replace(/\n/g, ' ');
    if (/^ .* $/.test(b) && b.trim()) b = b.slice(1, -1);
    return put(`<code>${esc(b)}</code>`);
  });
  // backslash escapes (ASCII punctuation)
  s = s.replace(/\\([\\`*_{}[\]()#+\-.!|<>~])/g, (m, ch) => put(esc(ch)));
  // hard break: backslash at end of line was consumed above only if followed by punctuation;
  // handle "\\\n" and two trailing spaces
  s = s.replace(/(?: {2,}|\\)\n/g, () => put('<br>'));
  // autolinks
  s = s.replace(/<(https?:\/\/[^\s<>]+)>/g, (m, url) => put(`<a href="${attr(link(url, ctx))}">${esc(url)}</a>`));
  // <kbd> is the one HTML tag allowed through
  s = s.replace(/<kbd>([^<]{1,40})<\/kbd>/g, (m, k) => put(`<kbd>${esc(k)}</kbd>`));
  // images and links: [text](href "title") — text may hold nested brackets one level deep
  s = s.replace(/(!?)\[((?:[^[\]]|\[[^[\]]*\])*)\]\(\s*<?([^\s)<>]*)>?(?:\s+"([^"]*)")?\s*\)/g, (m, bang, text, href, title) => {
    const t = title ? ` title="${attr(title)}"` : '';
    if (bang) return put(`<img src="${attr(link(href, ctx))}" alt="${attr(stripMd(text))}"${t} loading="lazy">`);
    const h = link(href, ctx);
    const ext = /^https?:\/\//.test(h) && !(ctx.site && h.startsWith(ctx.site)) ? ' rel="noopener"' : '';
    return put(`<a href="${attr(h)}"${t}${ext}>${inline(text, ctx, slots)}</a>`);
  });

  s = esc(s);
  // strong, then em (* and _), never across a placeholder boundary mid-token
  s = s.replace(/\*\*(?=\S)([\s\S]*?\S)\*\*/g, '<strong>$1</strong>');
  s = s.replace(/__(?=\S)([\s\S]*?\S)__(?!\w)/g, '<strong>$1</strong>');
  s = s.replace(/(^|[^*\w])\*(?=[^\s*])([^*]*?[^\s*])\*(?![*\w])/g, '$1<em>$2</em>');
  s = s.replace(/(^|[^\w])_(?=[^\s_])([^_]*?[^\s_])_(?![\w])/g, '$1<em>$2</em>');

  // restore (placeholders may nest: a link's text holds code spans)
  let prev;
  do { prev = s; s = s.replace(new RegExp(`${PH}(\\d+)${PH}`, 'g'), (m, n) => slots[+n]); } while (s !== prev);
  return s;
}

const link = (href, ctx) => (ctx.resolveLink ? ctx.resolveLink(href) : href);
/** Markdown → plain text (for alt text, TOC labels, slugs). */
export function stripMd(s) {
  return String(s)
    .replace(/`+([^`]*)`+/g, '$1')
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/<kbd>([^<]*)<\/kbd>/g, '$1')
    .replace(/\\([\\`*_{}[\]()#+\-.!|<>~])/g, '$1')
    .replace(/(\*\*|__|\*|_)(?=\S)([^*_]*?\S)\1/g, '$2')
    .trim();
}

// ───────────────────────── blocks ─────────────────────────

const RE = {
  fence: /^( {0,3})(`{3,}|~{3,})\s*([\w+#.-]*)[^\n]*$/,
  heading: /^ {0,3}(#{1,6})\s+(.*?)\s*$/,
  hr: /^ {0,3}([-*_])(?:\s*\1){2,}\s*$/,
  quote: /^ {0,3}>\s?/,
  item: /^(\s*)([-*+]|\d{1,9}[.)])(\s+|$)/,
  tableDelim: /^\s*\|?\s*:?-{1,}:?\s*(\|\s*:?-{1,}:?\s*)*\|?\s*$/,
};
const ALERTS = ['note', 'tip', 'important', 'warning', 'caution'];

const indentOf = (line) => { let n = 0; for (const ch of line) { if (ch === ' ') n++; else if (ch === '\t') n += 4; else break; } return n; };
const dedent = (line, n) => { let i = 0, w = 0; while (i < line.length && w < n && (line[i] === ' ' || line[i] === '\t')) { w += line[i] === '\t' ? 4 : 1; i++; } return line.slice(i); };
const isBlank = (l) => !l || !l.trim();
const isOrdered = (l) => /\d/.test(RE.item.exec(l)?.[2] || '');

/** Split a table row on unescaped pipes; `\|` becomes a literal pipe (also inside code spans, as on GitHub). */
export function splitRow(line) {
  let s = line.trim();
  if (s.startsWith('|')) s = s.slice(1);
  if (s.endsWith('|') && !s.endsWith('\\|')) s = s.slice(0, -1);
  const cells = []; let cur = '';
  for (let i = 0; i < s.length; i++) {
    if (s[i] === '\\' && s[i + 1] === '|') { cur += '|'; i++; continue; }
    if (s[i] === '|') { cells.push(cur.trim()); cur = ''; continue; }
    cur += s[i];
  }
  cells.push(cur.trim());
  return cells;
}

function startsBlock(line) {
  return RE.fence.test(line) || RE.heading.test(line) || RE.hr.test(line) || RE.quote.test(line) || RE.item.test(line);
}

/**
 * Render a Markdown document.
 * @returns {{ html: string, headings: {level:number, mdLevel:number, id:string, text:string, html:string}[], title: string }}
 */
export function renderMarkdown(src, opts = {}) {
  const st = {
    prefix: opts.idPrefix || '',
    shift: opts.shift ?? 0,
    twin: opts.twin || null,
    used: opts.used || new Set(),
    resolveLink: opts.resolveLink || null,
    site: opts.site || '',
    labels: { note: 'Note', tip: 'Tip', important: 'Important', warning: 'Warning', caution: 'Caution', ...(opts.labels || {}) },
    anchorLabel: opts.anchorLabel || 'Link to this section',
    headings: [],
    hIndex: 0,
    title: '',
  };
  const lines = String(src).replace(/\r\n?/g, '\n').split('\n');
  const html = blocks(lines, st);
  return { html, headings: st.headings, title: st.title };
}

function blocks(lines, st, tight = false) {
  const out = [];
  let i = 0;
  const para = [];
  const flush = () => {
    if (!para.length) return;
    const body = inline(para.join('\n').trim(), st);
    out.push(tight ? body : `<p>${body}</p>`);
    para.length = 0;
  };
  while (i < lines.length) {
    const line = lines[i];
    if (isBlank(line)) { flush(); i++; continue; }

    // fenced code
    let m = RE.fence.exec(line);
    if (m) {
      flush();
      const fence = m[2], lang = m[3] || '', ind = m[1].length;
      const body = [];
      i++;
      while (i < lines.length && !new RegExp(`^ {0,3}${fence[0] === '`' ? '`' : '~'}{${fence.length},}\\s*$`).test(lines[i])) { body.push(dedent(lines[i], ind)); i++; }
      i++;
      out.push(codeBlock(body.join('\n'), lang, st));
      continue;
    }

    // heading
    m = RE.heading.exec(line);
    if (m) { flush(); out.push(heading(m[1].length, m[2], st)); i++; continue; }

    // horizontal rule (before lists: "- - -" / "***")
    if (RE.hr.test(line) && !para.length) { flush(); out.push('<hr>'); i++; continue; }
    if (/^ {0,3}-{3,}\s*$/.test(line)) { flush(); out.push('<hr>'); i++; continue; }

    // blockquote / alert
    if (RE.quote.test(line)) {
      flush();
      const body = [];
      while (i < lines.length && !isBlank(lines[i]) && (RE.quote.test(lines[i]) || (body.length && !startsBlock(lines[i])))) {
        body.push(lines[i].replace(RE.quote, '')); i++;
      }
      out.push(quote(body, st));
      continue;
    }

    // table: a row with a pipe, followed by a delimiter row
    if (line.includes('|') && i + 1 < lines.length && RE.tableDelim.test(lines[i + 1]) && lines[i + 1].includes('-')) {
      flush();
      const head = splitRow(line);
      const aligns = splitRow(lines[i + 1]).map((c) => (/^:-+:$/.test(c) ? 'center' : /-+:$/.test(c) ? 'right' : /^:-+/.test(c) ? 'left' : ''));
      i += 2;
      const rows = [];
      while (i < lines.length && !isBlank(lines[i]) && lines[i].includes('|')) { rows.push(splitRow(lines[i])); i++; }
      out.push(table(head, aligns, rows, st));
      continue;
    }

    // list
    if (RE.item.test(line) && (!para.length || !/^\s/.test(line))) {
      flush();
      const start = i;
      const baseIndent = indentOf(line);
      i++;
      while (i < lines.length) {
        const l = lines[i];
        if (isBlank(l)) {
          // a blank line ends the list unless the next content is indented or another item at this level
          let j = i + 1; while (j < lines.length && isBlank(lines[j])) j++;
          if (j < lines.length && (indentOf(lines[j]) > baseIndent || (RE.item.test(lines[j]) && indentOf(lines[j]) === baseIndent && isOrdered(lines[j]) === isOrdered(line)))) { i = j; continue; }
          break;
        }
        if (indentOf(l) > baseIndent) { i++; continue; }
        if (RE.item.test(l) && indentOf(l) === baseIndent) {
          if (isOrdered(l) !== isOrdered(line)) break;          // bullets ↔ numbers: a new list
          i++; continue;
        }
        if (indentOf(l) <= baseIndent && !startsBlock(l) && !(l.includes('|') && i + 1 < lines.length && RE.tableDelim.test(lines[i + 1] || ''))) {
          // lazy continuation of the previous item's paragraph
          if (!isBlank(lines[i - 1])) { i++; continue; }
        }
        break;
      }
      out.push(list(lines.slice(start, i), st));
      continue;
    }

    para.push(line);
    i++;
  }
  flush();
  return out.join('\n');
}

function heading(mdLevel, raw, st) {
  let text = raw.replace(/\s+#+\s*$/, '');
  let explicit = null;
  const idm = /\s*\{#([\w-]+)\}\s*$/.exec(text);
  if (idm) { explicit = idm[1]; text = text.slice(0, idm.index); }
  const level = Math.min(6, mdLevel + st.shift);
  let id;
  if (mdLevel === 1) {
    id = explicit || st.prefix || slugify(text) || 'top';
    if (!st.title) st.title = stripMd(text);
  } else {
    const k = st.hIndex++;
    const tw = st.twin && st.twin[k];
    const base = slugify(stripMd(text));
    id = explicit
      || (tw && tw.mdLevel === mdLevel ? tw.id : null)
      || (base ? (st.prefix ? `${st.prefix}-${base}` : base) : `${st.prefix || 's'}-${k + 1}`);
  }
  // unique page-wide (a twin id is already unique on its own page)
  let uid = id, n = 2;
  while (st.used.has(uid)) uid = `${id}-${n++}`;
  st.used.add(uid);
  const inner = inline(text, st);
  st.headings.push({ level, mdLevel, id: uid, text: stripMd(text), html: inner });
  return `<h${level} id="${uid}">${inner}<a class="anchor" href="#${uid}" aria-label="${attr(st.anchorLabel)}">#</a></h${level}>`;
}

function codeBlock(code, lang, st) {
  const label = lang || 'text';
  return `<div class="term" data-lang="${attr(label)}"><div class="term-bar"><span>${esc(label)}</span><button type="button" class="copy" hidden>${esc(st.labels.copy || 'Copy')}</button></div><pre><code${lang ? ` class="language-${attr(lang)}"` : ''}>${highlight(code, lang)}</code></pre></div>`;
}

function quote(body, st) {
  const first = (body[0] || '').trim();
  const am = /^\[!(\w+)\]\s*$/.exec(first);
  if (am && ALERTS.includes(am[1].toLowerCase())) {
    const kind = am[1].toLowerCase();
    return `<aside class="callout callout-${kind}" role="note"><p class="callout-title">${esc(st.labels[kind])}</p>\n${blocks(body.slice(1), st)}\n</aside>`;
  }
  return `<blockquote>\n${blocks(body, st)}\n</blockquote>`;
}

function table(head, aligns, rows, st) {
  const cell = (tag, c, k) => `<${tag}${aligns[k] ? ` style="text-align:${aligns[k]}"` : ''}>${inline(c, st)}</${tag}>`;
  const n = head.length;
  const norm = (r) => { const x = r.slice(0, n); while (x.length < n) x.push(''); return x; };
  return `<div class="table-wrap"><table>\n<thead><tr>${head.map((c, k) => cell('th', c, k)).join('')}</tr></thead>\n<tbody>\n${rows.map((r) => `<tr>${norm(r).map((c, k) => cell('td', c, k)).join('')}</tr>`).join('\n')}\n</tbody>\n</table></div>`;
}

/** Parse a list block (its raw lines) into nested <ul>/<ol>. */
function list(lines, st) {
  const first = RE.item.exec(lines[0]);
  const base = indentOf(lines[0]);
  const ordered = /\d/.test(first[2]);
  const startNum = ordered ? parseInt(first[2], 10) : 1;
  const items = [];
  let cur = null;
  for (const l of lines) {
    const m = RE.item.exec(l);
    if (m && indentOf(l) === base) {
      const contentIndent = m[1].length + m[2].length + Math.max(1, Math.min(4, m[3].length || 1));
      cur = { lines: [l.slice(Math.min(l.length, m[0].length))], indent: contentIndent, loose: false };
      items.push(cur);
    } else if (cur) {
      if (isBlank(l)) cur.lines.push('');
      else cur.lines.push(indentOf(l) >= cur.indent ? dedent(l, cur.indent) : l.trim());
    }
  }
  // loose = blank line between this item's paragraphs (not just before a nested list)
  for (const it of items) {
    while (it.lines.length && isBlank(it.lines[it.lines.length - 1])) it.lines.pop();
    it.loose = it.lines.some((l, k) => isBlank(l) && k + 1 < it.lines.length && !RE.item.test(it.lines[k + 1]));
  }
  const lis = items.map((it) => {
    let body = it.lines;
    let task = '';
    const tm = /^\[([ xX])\]\s+/.exec(body[0] || '');
    if (tm) {
      const done = tm[1] !== ' ';
      task = `<input type="checkbox" disabled${done ? ' checked' : ''} aria-label="${attr(done ? (st.labels.done || 'done') : (st.labels.open || 'open'))}"> `;
      body = [body[0].slice(tm[0].length), ...body.slice(1)];
    }
    const inner = blocks(body, st, !it.loose);
    return `<li${task ? ' class="task"' : ''}>${task}${inner}</li>`;
  });
  const tag = ordered ? 'ol' : 'ul';
  const startAttr = ordered && startNum !== 1 ? ` start="${startNum}"` : '';
  return `<${tag}${startAttr}${items.some((x) => /^\[[ xX]\]\s/.test(x.lines[0] || '')) ? ' class="tasks"' : ''}>\n${lis.join('\n')}\n</${tag}>`;
}
