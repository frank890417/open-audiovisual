// @openav/pattern — one line of rhythm text → what plays when, bar by bar.
//
//   const p = compile('bd*4, [~ sd]*2, hh*8');   // never throws
//   p.ok / p.error                               // error: { code, index, length, message, hint }
//   p.eventsInBar(1, { seed })                   // [{ word, voice, pos, dur, vel, layer, token, n }] sorted by pos
//
// The way of writing (mini-notation) comes from TidalCycles and Strudel (https://tidalcycles.org,
// https://strudel.cc). This file is an independent implementation written from their public user
// documentation, the strudel.cc REPL's printed output, and Toussaint (2005) for Euclidean rhythms;
// no Strudel or Tidal source code was read. 依公開文件與論文獨立實作。
//
// Shape of the thing: parse() is a hand-written recursive-descent parser that keeps the character
// range of every word (the drum card lights the word that is sounding). compile() turns the tree into
// small query objects. Time inside the engine is exact fractions [num, den]: a bar of [bd sd sn]*3 is
// ninths, and bar 100 000 must land on the same ninths as bar 1, so nothing is added up across bars;
// each bar is asked for on its own and only converted to floats at the very end.
//
// Two questions every node answers:
//   on(t0, t1)  the hits that START in [t0, t1)            (what to play)
//   at(t)       the events that are SOUNDING at instant t  (what a Euclidean pulse picks up)
// The second one is why "[bd sd](3,8)" plays bd bd sd: each pulse takes whatever the bracket is
// playing at that moment, which is what strudel.cc does.

/** Drum words → kit voices of @openav/drums (its `GM` names). Tidal/Strudel short names plus OAV's own names. */
export const WORDS = Object.freeze({
  bd: 'kick', sd: 'snare', sn: 'snare', hh: 'hat', oh: 'openhat', cp: 'clap', rim: 'rim', rs: 'rim',
  lt: 'lowtom', mt: 'tom', ht: 'hightom', cr: 'crash', rd: 'ride', cb: 'cowbell',
  kick: 'kick', snare: 'snare', hat: 'hat', openhat: 'openhat', pedalhat: 'pedalhat', clap: 'clap',
  lowtom: 'lowtom', tom: 'tom', hightom: 'hightom', crash: 'crash', ride: 'ride', cowbell: 'cowbell',
});

// ---------------------------------------------------------------------------------------------- fractions
const gcd = (a, b) => { a = Math.abs(a); b = Math.abs(b); while (b) { const t = a % b; a = b; b = t; } return a; };
const Q = (n, d = 1) => { if (d < 0) { n = -n; d = -d; } const g = gcd(n, d) || 1; return [n / g, d / g]; };
const ZERO = [0, 1], ONE = [1, 1];
const add = (a, b) => Q(a[0] * b[1] + b[0] * a[1], a[1] * b[1]);
const sub = (a, b) => Q(a[0] * b[1] - b[0] * a[1], a[1] * b[1]);
const mul = (a, b) => Q(a[0] * b[0], a[1] * b[1]);
const div = (a, b) => Q(a[0] * b[1], a[1] * b[0]);
const lt = (a, b) => a[0] * b[1] < b[0] * a[1];
const le = (a, b) => a[0] * b[1] <= b[0] * a[1];
const maxQ = (a, b) => (lt(a, b) ? b : a);
const minQ = (a, b) => (lt(a, b) ? a : b);
/** Exact floor of a fraction (no float rounding at the edges of a bar). */
const floorQ = ([n, d]) => { let f = Math.floor(n / d); if (f * d > n) f--; else if ((f + 1) * d <= n) f++; return f; };
const ceilQ = (a) => -floorQ([-a[0], a[1]]);
const num = (a) => a[0] / a[1];
const lcm = (a, b) => (a && b ? Math.abs(a / gcd(a, b) * b) : 0);
const lcmQ = (a, b) => Q(lcm(a[0], b[0]), gcd(a[1], b[1]));
/** '2.75' → [11, 4]: decimals typed by a person are exact fractions, not floats. */
const parseDecimal = (s) => { const [i, f = ''] = s.split('.'); return Q(Number(i + f), 10 ** f.length); };

// ---------------------------------------------------------------------------------------------- Euclid
/**
 * Euclidean rhythm E(pulses, steps), rotated: an array of `steps` booleans.
 * Bjorklund's procedure as Toussaint (2005) describes it: start from `pulses` groups [1] and the rest [0];
 * keep putting one remainder group after each leading group; stop when the remainder is a single group.
 * E(3,8) = x..x..x. (tresillo), E(5,8) = x.xx.xx. (cinquillo).
 * `rotate` starts the pattern that many steps later (strudel.cc: "the starting position for distributing
 * the beats"; bd(3,8,2) → steps 0, 2, 5). Negative goes earlier. Negative `pulses` plays the gaps
 * instead of the pulses, as strudel.cc does.
 */
export function euclid(pulses, steps, rotate = 0) {
  const k = Math.abs(Math.trunc(pulses)), n = Math.trunc(steps);
  if (!(n >= 1)) return [];
  let bits;
  if (k === 0) bits = new Array(n).fill(false);
  else if (k >= n) bits = new Array(n).fill(true);
  else {
    let a = Array.from({ length: k }, () => [true]);
    let b = Array.from({ length: n - k }, () => [false]);
    while (b.length > 1) {
      const m = Math.min(a.length, b.length);
      const next = [];
      for (let i = 0; i < m; i++) next.push(a[i].concat(b[i]));
      b = a.length > m ? a.slice(m) : b.slice(m);
      a = next;
    }
    bits = a.flat().concat(b.flat());
  }
  if (pulses < 0) bits = bits.map((x) => !x);
  const r = ((Math.trunc(rotate) % n) + n) % n;
  return bits.map((_, j) => bits[(j - r + n) % n]);
}

// ---------------------------------------------------------------------------------------------- parser
class Fail extends Error { constructor(info) { super(info.message); this.info = info; } }
const fail = (code, index, length, message, hint) => { throw new Fail({ code, index, length: Math.max(1, length), message, hint }); };

const WORD_START = /[A-Za-z0-9#]/;
const WORD_CHAR = /[A-Za-z0-9#._~-]/;     // strudel.cc reads "bd-sd", "bd." as one (unknown) word; so do we
const MODIFIER = new Set(['*', '/', '@', '!', '?', '(']);
const UNSUPPORTED = {
  '.': ['"." (grouping steps with dots) is not supported here.', 'Use [ ] to group, and ~ or - for a rest: "bd ~ sd ~", not "bd . sd ."'],
  '|': ['"|" (pick one at random) is not supported here.', 'Write one choice, or use ? to drop a step now and then: "hh*8?"'],
  '{': ['"{ }" (polymeter) is not supported here.', 'Use [ ] and , instead: "[bd sd, hh hh hh]"'],
  '}': ['"{ }" (polymeter) is not supported here.', 'Use [ ] and , instead: "[bd sd, hh hh hh]"'],
  '%': ['"%" (steps per cycle) is not supported here.', 'Use *n to fit more steps in a bar: "hh*8"'],
  '^': ['"^" (stepwise marks) is not supported here.', 'Remove the ^'],
  ':': ['":" goes right after a sound name.', 'Write the sample number like this: "bd:2"'],
};
const CLOSER_OF = { '[': ']', '<': '>' };
/** Hints for characters that are not mini-notation; full-width punctuation is the usual one on a CJK keyboard. */
const oddChar = (c) => {
  if (/[\uFF01-\uFF5E\u3000\u3001\u3002]/.test(c)) return 'This is a full-width character: switch the keyboard to half-width (半形) for symbols like * [ ] , ~';
  if (c === '"' || c === "'" || c === '`') return 'Leave the quotes out of the pattern itself: bd sd, not "bd sd"';
  return 'Write sounds separated by spaces, like "bd sd hh"';
};

/**
 * Parse mini-notation into a tree. Never throws: `{ ok: true, tree }` or `{ ok: false, error }`.
 * Nodes: `step` { word, n, start, end } · `rest` · `seq` { steps: [{ node, weight }] } · `layer` { layers } ·
 * `alt` { steps } (one per bar) · `fast` / `slow` { factor, node } · `euclid` { pulses, slots, rotate, node } ·
 * `maybe` { chance, id, node }. Every node has `start`/`end` (character range in the source).
 * The tree's root is always a `layer` whose `layers` are the top-level comma parts.
 */
export function parse(src) {
  src = src == null ? '' : String(src);
  try { return { ok: true, tree: new Parser(src).top(), error: null }; }
  catch (e) { if (e instanceof Fail) return { ok: false, tree: null, error: e.info }; throw e; }
}

class Parser {
  constructor(src) { this.s = src; this.i = 0; }
  peek(o = 0) { return this.s[this.i + o]; }
  ws() { while (this.i < this.s.length && /\s/.test(this.s[this.i])) this.i++; }

  top() {
    this.ws();
    if (this.i >= this.s.length) fail('empty', 0, this.s.length, 'The pattern is empty.', 'Write at least one sound, for example "bd sd"');
    const layers = this.layers(null, 0);
    if (this.i < this.s.length) this.stray();
    return { type: 'layer', layers, start: 0, end: this.s.length };
  }

  /** Comma-separated sequences up to `close` (null = end of text). */
  layers(close, openAt) {
    const out = [];
    for (;;) {
      const seq = this.sequence(close, openAt);
      out.push(seq);
      this.ws();
      if (this.peek() !== ',') return out;
      this.i++;
    }
  }

  sequence(close, openAt) {
    const steps = [];
    const begin = this.i;
    for (;;) {
      this.ws();
      const c = this.peek();
      if (c === undefined || c === close || c === ',') break;
      if (c === ']' || c === '>' || c === ')') this.stray(close, openAt);
      if (MODIFIER.has(c) && steps.length) { this.modifiers(steps[steps.length - 1]); continue; }   // "bd *2", "bd ! sd"
      if (MODIFIER.has(c)) fail('unexpected', this.i, 1, `"${c}" needs a sound before it.`, c === '!' ? '"!" repeats the step before it: "bd ! sd" is "bd bd sd"' : `Put it right after a sound, like "bd${c === '(' ? '(3,8)' : c + '2'}"`);
      if (c === '_') {                       // "bd _ _ sd": the step before lasts longer
        if (!steps.length) fail('unexpected', this.i, 1, '"_" needs a sound before it.', '"bd _ sd" makes bd last two steps');
        steps[steps.length - 1].weight = add(steps[steps.length - 1].weight, ONE);
        this.i++; continue;
      }
      const step = { node: this.primary(), weight: ONE, reps: 1 };
      this.modifiers(step);
      steps.push(step);
    }
    if (!steps.length) {      // "bd," · ", bd" · "[bd, ]" — an empty side of a comma ("[]" is caught in primary())
      const at = this.peek() === ',' ? this.i : this.s.lastIndexOf(',', this.i - 1);
      fail('empty', at < 0 ? openAt : at, 1, 'Nothing on one side of a comma.', 'Each side of "," is its own rhythm: "bd*4, hh*8"');
    }
    const flat = [];
    for (const st of steps) for (let r = 0; r < st.reps; r++) flat.push({ node: st.node, weight: st.weight });
    return { type: 'seq', steps: flat, start: begin, end: this.i };
  }

  stray(close = null, openAt = 0) {
    const c = this.peek();
    if (close && (c === ']' || c === '>' || c === ')')) {
      fail('unexpected', this.i, 1, `"${c}" does not close the "${this.s[openAt]}" at character ${openAt + 1}.`, `Close that group with "${close}"`);
    }
    if (c === ']' || c === '>' || c === ')') {
      const open = { ']': '[', '>': '<', ')': '(' }[c];
      fail('unexpected', this.i, 1, `"${c}" closes a "${open}" that was never opened.`, `Remove it, or add the "${open}" where the group starts`);
    }
    fail('unexpected', this.i, 1, `Unexpected "${c}".`, oddChar(c));
  }

  primary() {
    const start = this.i, c = this.peek();
    if (c === '[' || c === '<') {
      this.i++;
      this.ws();
      const close = CLOSER_OF[c];
      if (this.i >= this.s.length) fail('unclosed', start, 1, `"${c}" is never closed.`, `Add "${close}" where the group ends`);
      if (this.peek() === close) fail('empty', start, this.i - start + 1, 'Nothing between the brackets.', `Put a sound inside, like "${c}bd sd${close}", or remove the brackets`);
      const layers = this.layers(close, start);
      if (this.peek() !== close) {
        if (this.i >= this.s.length) fail('unclosed', start, 1, `"${c}" is never closed.`, `Add "${close}" where the group ends`);
        this.stray(close, start);
      }
      this.i++;
      if (c === '[') return layers.length === 1 ? { ...layers[0], start, end: this.i } : { type: 'layer', layers, start, end: this.i };
      const alts = layers.map((l) => ({ type: 'alt', steps: l.steps, start, end: this.i }));
      return alts.length === 1 ? alts[0] : { type: 'layer', layers: alts, start, end: this.i };
    }
    if (c === '~') { this.i++; return { type: 'rest', start, end: this.i }; }
    if (c === '-' && !/[0-9]/.test(this.peek(1) || '')) { this.i++; return { type: 'rest', start, end: this.i }; }
    if (c === '.' && this.peek(1) === '.') fail('unsupported', start, 2, '".." (ranges) is not supported here.', 'Write each step out: "0 1 2 3"');
    if (UNSUPPORTED[c]) fail('unsupported', start, 1, UNSUPPORTED[c][0], UNSUPPORTED[c][1]);
    if (WORD_START.test(c) || c === '-') {
      this.i++;
      while (this.i < this.s.length && WORD_CHAR.test(this.peek())) this.i++;
      const word = this.s.slice(start, this.i);
      let n = null;
      if (this.peek() === ':') {
        const at = this.i++;
        const m = /^-?\d+(\.\d+)?/.exec(this.s.slice(this.i));
        if (!m) fail('bad-number', at, 1, '":" needs a number after it.', 'Sample numbers look like "bd:2"');
        n = Number(m[0]); this.i += m[0].length;
        if (this.peek() === ':') fail('bad-number', this.i, 1, 'Only one ":" per sound.', 'Write "bd:2"');
      }
      return { type: 'step', word, n, start, end: this.i };
    }
    fail('unexpected', start, 1, `Unexpected "${c}".`, oddChar(c));
  }

  number(opAt, what) {
    const m = /^\d+(\.\d+)?/.exec(this.s.slice(this.i));
    if (!m) fail('bad-number', opAt, this.i - opAt, `"${this.s[opAt]}" needs a number after it.`, what);
    this.i += m[0].length;
    return parseDecimal(m[0]);
  }

  /** Modifiers that follow a step: *n /n @n !n ! ?p (k,n,r). Apply in the order written. */
  modifiers(step) {
    for (;;) {
      const at = this.i, c = this.peek();
      if (c === '*' || c === '/') {
        this.i++;
        const f = this.number(at, c === '*' ? 'Faster: "hh*8" plays hh eight times in its step' : 'Slower: "bd/2" plays bd every two bars');
        if (f[0] === 0) fail('bad-number', at, this.i - at, `"${c}0" is not allowed.`, c === '*' ? 'Use *1 or more' : 'Use /1 or more');
        step.node = { type: c === '*' ? 'fast' : 'slow', factor: f, node: step.node, start: step.node.start, end: this.i };
      } else if (c === '@') {
        this.i++;
        const w = this.number(at, 'Longer: "bd@3 sd" makes bd three times as long as sd');
        if (w[0] === 0) fail('bad-number', at, this.i - at, '"@0" is not allowed.', 'A step needs a length above 0, like "@2"');
        step.weight = w;
      } else if (c === '!') {
        this.i++;
        if (/[0-9]/.test(this.peek() || '')) {
          const r = this.number(at, '"bd!3" repeats bd three times');
          if (r[1] !== 1 || r[0] < 1) fail('bad-number', at, this.i - at, '"!" needs a whole number of 1 or more.', '"bd!3" repeats bd three times');
          step.reps += r[0] - 1;
        } else step.reps += 1;
      } else if (c === '?') {
        this.i++;
        let chance = Q(1, 2);
        if (/[0-9]/.test(this.peek() || '')) {
          chance = this.number(at, '"hh?0.3" drops hh 30% of the time');
          if (lt(ONE, chance)) fail('bad-number', at, this.i - at, 'The chance after "?" is between 0 and 1.', '"hh?0.3" drops hh 30% of the time');
        }
        step.node = { type: 'maybe', chance, id: at, node: step.node, start: step.node.start, end: this.i };
      } else if (c === '(') {
        step.node = this.euclidArgs(step.node);
      } else return;
    }
  }

  euclidArgs(node) {
    const open = this.i++;
    const nums = [];
    const hint = '"bd(3,8)" spreads 3 hits over 8 steps; "bd(3,8,2)" starts them 2 steps later';
    for (;;) {
      this.ws();
      const m = /^-?\d+(\.\d+)?/.exec(this.s.slice(this.i));
      if (!m) {
        if (this.i >= this.s.length) fail('unclosed', open, 1, '"(" is never closed.', 'Add ")": "bd(3,8)"');
        fail('bad-euclid', open, this.i - open + 1, 'Inside ( ) go two or three whole numbers.', hint);
      }
      this.i += m[0].length;
      nums.push(m[0]);
      this.ws();
      const c = this.peek();
      if (c === ',') { this.i++; continue; }
      if (c === ')') { this.i++; break; }
      if (c === undefined) fail('unclosed', open, 1, '"(" is never closed.', 'Add ")": "bd(3,8)"');
      fail('bad-euclid', open, this.i - open + 1, 'Inside ( ) go two or three whole numbers, separated by commas.', hint);
    }
    const len = this.i - open;
    if (nums.length < 2 || nums.length > 3) fail('bad-euclid', open, len, `( ) takes two or three numbers, not ${nums.length}.`, hint);
    if (nums.some((x) => x.includes('.'))) fail('bad-euclid', open, len, 'The numbers inside ( ) are whole numbers.', hint);
    const [k, n, r = 0] = nums.map(Number);
    if (n < 1) fail('bad-euclid', open, len, 'The second number (steps) must be 1 or more.', hint);
    if (Math.abs(k) > n) fail('bad-euclid', open, len, `${Math.abs(k)} hits do not fit in ${n} steps.`, `The first number can be at most the second: "bd(${n},${n})"`);
    return { type: 'euclid', pulses: k, slots: n, rotate: r, node, start: node.start, end: this.i };
  }
}

// ---------------------------------------------------------------------------------------------- engine
// Internal event: { t: onset (fraction), d: length (fraction), s: the `step` node that sounds }.
const SILENCE = { on() {}, at: () => [] };

const mix = (h) => { h ^= h >>> 16; h = Math.imul(h, 0x85ebca6b); h ^= h >>> 13; h = Math.imul(h, 0xc2b2ae35); h ^= h >>> 16; return h >>> 0; };
const hashSeed = (seed) => {
  if (typeof seed === 'number' && Number.isInteger(seed)) return mix((seed | 0) ^ 0x9e3779b9);
  let h = 0x811c9dc5; const s = String(seed);
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 0x01000193);
  return mix(h);
};
/** A number in [0, 1) fixed by (seed, which ?, where in the pattern, when). Same inputs, same answer. */
const roll = (ctx, id, t) => {
  let h = mix(ctx.seed ^ Math.imul(id + 1, 0x27d4eb2d));
  h = mix(h ^ ctx.salt);
  h = mix(h ^ (t[0] | 0) ^ Math.imul(Math.floor(t[0] / 4294967296) | 0, 0x165667b1));
  h = mix(h ^ Math.imul(t[1] | 0, 0x9e3779b1));
  return h / 4294967296;
};

function build(node) {
  switch (node.type) {
    case 'step': return atom(node);
    case 'rest': return SILENCE;
    case 'seq': return sequence(node.steps.map((s) => ({ weight: s.weight, pat: build(s.node) })));
    case 'layer': return stack(node.layers.map(build));
    case 'alt': {                         // <a b c> = [a b c] stretched over as many bars as it has steps (weights count)
      const total = node.steps.reduce((a, s) => add(a, s.weight), ZERO);
      return fast(div(ONE, total), sequence(node.steps.map((s) => ({ weight: s.weight, pat: build(s.node) }))));
    }
    case 'fast': return fast(node.factor, build(node.node));
    case 'slow': return fast(div(ONE, node.factor), build(node.node));
    case 'euclid': return pulses(euclid(node.pulses, node.slots, node.rotate), build(node.node));
    case 'maybe': return maybe(node.chance, node.id, build(node.node));
    default: return SILENCE;
  }
}

/** A sound: one hit at the start of every bar of its own time. */
const atom = (s) => ({
  on(t0, t1, ctx, out) { for (let c = ceilQ(t0); lt([c, 1], t1); c++) out.push({ t: [c, 1], d: ONE, s }); },
  at(t) { return [{ t: [floorQ(t), 1], d: ONE, s }]; },
});

/** Steps side by side in one bar, each squeezed into its share. A step sees the same bar number as its parent. */
function sequence(parts) {
  const total = parts.reduce((a, p) => add(a, p.weight), ZERO);
  let o = ZERO;
  const slots = parts.map((p, i) => {
    const f = div(o, total), g = div(p.weight, total);
    o = add(o, p.weight);
    return { f, g, pat: p.pat, salt: i + 1 };
  });
  // each slot gets its own random stream, so "hh?!2" decides its two hits separately
  const inner = (ctx, salt) => ({ seed: ctx.seed, salt: mix(ctx.salt ^ Math.imul(salt, 0x2545f491)) });
  return {
    on(t0, t1, ctx, out) {
      for (let c = floorQ(t0); lt([c, 1], t1); c++) {
        const C = [c, 1];
        for (const { f, g, pat, salt } of slots) {
          const s0 = add(C, f), s1 = add(s0, g);
          const a = maxQ(s0, t0), b = minQ(s1, t1);
          if (!lt(a, b)) continue;
          const tmp = [];
          pat.on(add(C, div(sub(a, s0), g)), add(C, div(sub(b, s0), g)), inner(ctx, salt), tmp);
          for (const e of tmp) out.push({ t: add(s0, mul(sub(e.t, C), g)), d: mul(e.d, g), s: e.s });
        }
      }
    },
    at(t, ctx) {
      const c = floorQ(t), C = [c, 1], x = sub(t, C);
      for (const { f, g, pat, salt } of slots) {
        if (!(le(f, x) && lt(x, add(f, g)))) continue;
        const s0 = add(C, f);
        return pat.at(add(C, div(sub(x, f), g)), inner(ctx, salt)).map((e) => ({ t: add(s0, mul(sub(e.t, C), g)), d: mul(e.d, g), s: e.s }));
      }
      return [];
    },
  };
}

const stack = (pats) => ({
  on(t0, t1, ctx, out) { for (const p of pats) p.on(t0, t1, ctx, out); },
  at(t, ctx) { return pats.flatMap((p) => p.at(t, ctx)); },
});

/** Time runs k times faster inside (k < 1 = slower). */
const fast = (k, pat) => ({
  on(t0, t1, ctx, out) {
    const tmp = [];
    pat.on(mul(t0, k), mul(t1, k), ctx, tmp);
    for (const e of tmp) out.push({ t: div(e.t, k), d: div(e.d, k), s: e.s });
  },
  at(t, ctx) { return pat.at(mul(t, k), ctx).map((e) => ({ t: div(e.t, k), d: div(e.d, k), s: e.s })); },
});

/** Euclidean pulses: each pulse plays whatever the inner pattern is sounding at that instant. */
function pulses(bits, pat) {
  const n = bits.length, step = Q(1, n);
  return {
    on(t0, t1, ctx, out) {
      for (let c = floorQ(t0); lt([c, 1], t1); c++) {
        for (let j = 0; j < n; j++) {
          if (!bits[j]) continue;
          const a = Q(c * n + j, n);
          if (le(t0, a) && lt(a, t1)) for (const e of pat.at(a, ctx)) out.push({ t: a, d: step, s: e.s });
        }
      }
    },
    at(t, ctx) {
      const c = floorQ(t), j = floorQ(mul(sub(t, [c, 1]), [n, 1]));
      if (!bits[j]) return [];
      const a = Q(c * n + j, n);
      return pat.at(a, ctx).map((e) => ({ t: a, d: step, s: e.s }));
    },
  };
}

/** "?": drop each hit with this chance, decided by the seed and the hit's time, so a bar replays the same. */
function maybe(chance, id, pat) {
  const keep = (e, ctx) => roll(ctx, id, e.t) >= num(chance);
  return {
    on(t0, t1, ctx, out) { const tmp = []; pat.on(t0, t1, ctx, tmp); for (const e of tmp) if (keep(e, ctx)) out.push(e); },
    at(t, ctx) { return pat.at(t, ctx).filter((e) => keep(e, ctx)); },
  };
}

/** How many bars until the written structure repeats (a "?" aside). */
function period(node) {
  const whole = (p) => [p[0], 1];       // a part squeezed into each bar repeats after its numerator's worth of bars
  switch (node.type) {
    case 'seq': return node.steps.reduce((a, s) => lcmQ(a, whole(period(s.node))), ONE);
    case 'layer': return node.layers.reduce((a, l) => lcmQ(a, period(l)), ONE);
    case 'alt': {
      const total = node.steps.reduce((a, s) => add(a, s.weight), ZERO);
      return mul(total, node.steps.reduce((a, s) => lcmQ(a, whole(period(s.node))), ONE));
    }
    case 'fast': return div(period(node.node), node.factor);
    case 'slow': return mul(period(node.node), node.factor);
    case 'euclid': return whole(period(node.node));
    case 'maybe': return period(node.node);
    default: return ONE;
  }
}

function walkSteps(node, fn) {
  if (node.type === 'step') return fn(node);
  for (const s of node.steps || []) walkSteps(s.node, fn);
  for (const l of node.layers || []) walkSteps(l, fn);
  if (node.node) walkSteps(node.node, fn);
}

function editDistance(a, b) {
  const row = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    let prev = row[0]; row[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const cur = row[j];
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = cur;
    }
  }
  return row[b.length];
}

const SHORT_NAMES = 'bd sd hh oh cp rim lt mt ht cr rd cb';

function unknownWord(step, words) {
  const w = step.word, low = w.toLowerCase();
  const length = w.length;
  if (/^-?\d/.test(w)) {
    return { code: 'unknown-word', index: step.start, length, suggestion: null, message: `"${w}" is a number, not a sound.`, hint: `Write a drum name (${SHORT_NAMES}); a sample number goes after a colon: "bd:${w}"` };
  }
  if (w.includes('.')) {
    return { code: 'unknown-word', index: step.start, length, suggestion: null, message: `"${w}" is not a sound name.`, hint: 'A rest is ~ or - with spaces around it: "bd ~ ~ ~", not "x..."' };
  }
  let best = null, bestD = Infinity;
  for (const k of Object.keys(words)) { const d = editDistance(low, k); if (d < bestD) { best = k; bestD = d; } }
  const close = best && bestD <= Math.max(1, Math.floor(low.length / 2));
  return {
    code: 'unknown-word', index: step.start, length, suggestion: close ? best : null,
    message: `"${w}" is not a sound name.`,
    hint: close ? `Did you mean "${best}"? Sounds: ${SHORT_NAMES} (or kick, snare, hat, clap…)` : `Sounds: ${SHORT_NAMES} (or kick, snare, hat, clap…)`,
  };
}

/**
 * Compile a line of mini-notation for the drum kit. Never throws.
 * → { ok, error, src, voices, layers, period, eventsInBar(bar, { seed }) }
 *   eventsInBar: bar counts from 1; events sorted by pos (0..1 within the bar):
 *   { word, voice, n, pos, dur, vel, layer, token: { start, end } }. `dur` is in bars and may run past the bar
 *   ("bd/2" lasts two). `layer` is the top-level comma part. A failed compile returns [] for every bar.
 */
export function compile(src, { words = WORDS } = {}) {
  src = src == null ? '' : String(src);
  const failed = (error) => ({ ok: false, error, src, voices: [], layers: 0, period: 1, eventsInBar: () => [] });
  try {
    const parsed = parse(src);
    if (!parsed.ok) return failed(parsed.error);
    const tree = parsed.tree;
    const voices = [];
    let bad = null;
    walkSteps(tree, (st) => {
      const voice = words[st.word] ?? words[st.word.toLowerCase()];
      if (voice == null) { bad = bad || unknownWord(st, words); return; }
      st.voice = voice;
      if (!voices.includes(voice)) voices.push(voice);
    });
    if (bad) return failed(bad);
    const layers = tree.layers.map(build);
    const per = lcmQ(period(tree), ONE)[0];
    return {
      ok: true, error: null, src, voices, layers: layers.length, period: per,
      eventsInBar(bar, { seed = 0 } = {}) {
        const c = Number.isFinite(Number(bar)) ? Math.floor(Number(bar)) - 1 : 0;
        const t0 = [c, 1], t1 = [c + 1, 1];
        const ctx = { seed: hashSeed(seed), salt: 0 };
        const out = [];
        layers.forEach((pat, layer) => {
          const tmp = [];
          pat.on(t0, t1, ctx, tmp);
          for (const e of tmp) {
            out.push({
              word: e.s.word, voice: e.s.voice, n: e.s.n, pos: num(sub(e.t, t0)), dur: num(e.d), vel: 1, layer,
              token: { start: e.s.start, end: e.s.end },
            });
          }
        });
        return out.sort((a, b) => a.pos - b.pos || a.layer - b.layer || a.token.start - b.token.start);
      },
    };
  } catch (e) {
    return failed({ code: 'internal', index: 0, length: Math.max(1, src.length), message: `Could not read the pattern (${e && e.message}).`, hint: 'Try a simpler pattern, like "bd sd"' });
  }
}
