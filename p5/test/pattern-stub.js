// pattern-stub.js — a stand-in for @openav/pattern in the browser smoke (rhythm-smoke.cjs), until the real package is merged.
// Same interface (fixed by the plan): compile(text) → { ok, error: { code, index, length, message, hint }, eventsInBar(bar,
// { seed }) → [{ word, voice, pos, dur, vel, layer, token: { start, end } }] }. A small subset only: words and ~, spaces,
// [ ] groups, < > one per bar, *n, (k,n[,r]) Euclid, and "," layers. Written for the test from the notation's documented
// meaning; it is not the package and is not shipped.
const VOICE = { bd: 'kick', sd: 'snare', hh: 'hat', oh: 'openhat', cp: 'clap', rim: 'rim', rs: 'rim', lt: 'lowtom', mt: 'tom', ht: 'hightom',
  cr: 'crash', rd: 'ride', cb: 'cowbell', kick: 'kick', snare: 'snare', hat: 'hat', clap: 'clap', crash: 'crash', ride: 'ride' };

class Bad extends Error { constructor(code, index, length, message) { super(message); this.code = code; this.index = index; this.length = length; } }

function parse(text) {
  let i = 0;
  const ws = () => { while (i < text.length && /\s/.test(text[i])) i++; };
  const num = () => { const m = /^\d+(\.\d+)?/.exec(text.slice(i)); if (!m) throw new Bad('bad-number', i, 1, 'a number'); i += m[0].length; return +m[0]; };
  function layers(close) {
    const out = [seq(close)];
    while (text[i] === ',') { i++; out.push(seq(close)); }
    return out;
  }
  function seq(close) {
    const terms = [];
    for (;;) {
      ws();
      if (i >= text.length) { if (close) throw new Bad('unclosed', open.at(-1), 1, 'unclosed'); break; }
      if (text[i] === ',' || (close && text[i] === close)) break;
      terms.push(term());
    }
    return terms;
  }
  const open = [];
  function term() {
    let t;
    const at = i;
    if (text[i] === '[' || text[i] === '<') {
      const c = text[i] === '[' ? ']' : '>'; open.push(i); i++;
      const l = layers(c);
      if (text[i] !== c) throw new Bad('unclosed', at, 1, 'unclosed');
      i++; open.pop();
      t = { kind: c === ']' ? 'group' : 'alt', layers: l };
    } else {
      const m = /^[a-z~]+/i.exec(text.slice(i));
      if (!m) throw new Bad('unexpected', i, 1, `unexpected "${text[i]}"`);
      i += m[0].length;
      if (m[0] !== '~' && !VOICE[m[0]]) throw new Bad('unknown-word', at, m[0].length, `unknown word ${m[0]}`);
      t = { kind: m[0] === '~' ? 'rest' : 'word', word: m[0], token: { start: at, end: i } };
    }
    if (text[i] === '*') { i++; t = { kind: 'fast', n: num(), t }; }
    if (text[i] === '(') {
      const e = i; i++; const k = num(); if (text[i] !== ',') throw new Bad('bad-euclid', e, i - e + 1, 'euclid'); i++;
      const n = num(); let r = 0; if (text[i] === ',') { i++; r = num(); }
      if (text[i] !== ')' || k > n) throw new Bad('bad-euclid', e, i - e + 1, 'euclid');
      i++; t = { kind: 'euclid', k, n, r, t };
    }
    return t;
  }
  const l = layers(null);
  if (i < text.length) throw new Bad('unexpected', i, 1, 'unexpected');
  return l;
}

function render(node, a, b, bar, out, layer) {
  if (node.kind === 'rest') return;
  if (node.kind === 'word') { out.push({ word: node.word, voice: VOICE[node.word], pos: a, dur: b - a, vel: 1, layer, token: node.token }); return; }
  if (node.kind === 'fast') { const w = (b - a) / node.n; for (let k = 0; k < node.n; k++) render(node.t, a + k * w, a + (k + 1) * w, bar, out, layer); return; }
  if (node.kind === 'euclid') {
    const w = (b - a) / node.n;
    for (let k = 0; k < node.n; k++) { const j = (k + node.r) % node.n; if ((j * node.k) % node.n < node.k) render(node.t, a + k * w, a + (k + 1) * w, bar, out, layer); }   // (3,8) = x..x..x.
    return;
  }
  if (node.kind === 'group') { for (const l of node.layers) seqRender(l, a, b, bar, out, layer); return; }
  if (node.kind === 'alt') { for (const l of node.layers) { if (!l.length) continue; render(l[(bar - 1) % l.length], a, b, bar, out, layer); } }
}
function seqRender(terms, a, b, bar, out, layer) { const w = (b - a) / (terms.length || 1); terms.forEach((t, k) => render(t, a + k * w, a + (k + 1) * w, bar, out, layer)); }

export function compile(text) {
  try {
    const l = parse(String(text));
    if (!l.some((s) => s.length)) throw new Bad('empty', 0, 0, 'empty');
    return { ok: true, error: null, text, eventsInBar(bar) { const out = []; l.forEach((s, k) => seqRender(s, 0, 1, bar, out, k)); return out.filter((e) => e.pos < 1).sort((x, y) => x.pos - y.pos); } };
  } catch (e) {
    if (!(e instanceof Bad)) throw e;
    return { ok: false, error: { code: e.code, index: e.index, length: e.length, message: e.message, hint: '' } };
  }
}
