// Shared parts of the @openav/align tests: the example layouts, a recording 2D context, a fake three.js and renderer
// (they record every call), the numbers of a layout one by one, and the words that must never reach a public page.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const ALIGN = path.join(ROOT, 'packages/align');
export const loadLayout = (id) => JSON.parse(fs.readFileSync(path.join(ALIGN, 'layouts', `${id}.json`), 'utf8'));
export const clone = (o) => JSON.parse(JSON.stringify(o));

/** Every number of an object as [path, value], leaves only. */
export function numericLeaves(obj, prefix = '') {
  const out = [];
  if (obj && typeof obj === 'object') for (const [k, v] of Object.entries(obj)) out.push(...numericLeaves(v, prefix ? `${prefix}.${k}` : k));
  else if (typeof obj === 'number') out.push(prefix);
  return out;
}
/** A copy with the number at path changed by d. */
export function mutate(obj, p, d) {
  const o = clone(obj), keys = p.split('.');
  let x = o;
  for (const k of keys.slice(0, -1)) x = x[k];
  x[keys.at(-1)] += d;
  return o;
}

/** A 2D context that records what is drawn: calls as [name, …args], property writes as ['set', name, value]. */
export function fakeCtx() {
  const calls = [];
  const state = { fillStyle: '#000', strokeStyle: '#000', lineWidth: 1, font: '', textAlign: 'left', textBaseline: 'top', globalAlpha: 1 };
  const stack = [];
  return new Proxy(state, {
    get(t, k) {
      if (k === 'calls') return calls;
      if (k === 'save') return () => { stack.push({ ...state }); calls.push(['save']); };
      if (k === 'restore') return () => { Object.assign(state, stack.pop() || {}); calls.push(['restore']); };
      if (k === 'measureText') return (s) => ({ width: String(s).length * 10 });
      if (k === 'createLinearGradient' || k === 'createRadialGradient') return (...a) => { const g = { addColorStop: () => {} }; calls.push(['gradient', ...a]); return g; };
      if (k in t) return t[k];
      return (...a) => { calls.push([k, ...a]); };
    },
    set(t, k, v) { t[k] = v; calls.push(['set', k, v]); return true; },
  });
}
export const texts = (ctx) => ctx.calls.filter((c) => c[0] === 'fillText').map((c) => c[1]);

/** Just enough of three.js for createBlitter, createWarpRenderer and createPatternTexture, recording what they build. */
export function fakeThree() {
  class Vector2 { constructor(x = 0, y = 0) { this.x = x; this.y = y; } set(x, y) { this.x = x; this.y = y; return this; } }
  class Vector4 { constructor(x = 0, y = 0, z = 0, w = 0) { Object.assign(this, { x, y, z, w }); } }
  class ShaderMaterial { constructor(o) { Object.assign(this, o); this.disposed = false; } dispose() { this.disposed = true; } }
  class Scene { constructor() { this.children = []; } add(m) { this.children.push(m); } remove(m) { this.children = this.children.filter((x) => x !== m); } }
  class Mesh { constructor(g, m) { this.geometry = g; this.material = m; } }
  class PlaneGeometry {}
  class BufferAttribute { constructor(array, size) { this.array = array; this.itemSize = size; } }
  class BufferGeometry { constructor() { this.attributes = {}; this.disposed = false; } setAttribute(k, a) { this.attributes[k] = a; } setIndex(a) { this.index = a; } dispose() { this.disposed = true; } }
  class OrthographicCamera { constructor(l, r, t, b) { Object.assign(this, { left: l, right: r, top: t, bottom: b, updates: 0 }); } updateProjectionMatrix() { this.updates++; } }
  class CanvasTexture { constructor(c) { this.image = c; this.needsUpdate = false; this.disposed = false; } dispose() { this.disposed = true; } }
  return { Vector2, Vector4, ShaderMaterial, Scene, Mesh, PlaneGeometry, BufferAttribute, BufferGeometry, OrthographicCamera, CanvasTexture, DoubleSide: 2, AdditiveBlending: 2, LinearFilter: 1006, NoColorSpace: '' };
}

/** A renderer that records what a blit does: W × H physical px at pixel ratio pr. */
export function fakeRenderer({ W, H, pr }) {
  const log = [];
  const renderer = {
    autoClear: true,
    getPixelRatio: () => pr,
    getDrawingBufferSize: (v) => v.set(W, H),
    setRenderTarget: (t) => log.push(['renderTarget', t]),
    setScissorTest: (on) => log.push(['scissorTest', on]),
    setViewport: (x, y, w, h) => log.push(['viewport', x, y, w, h]),
    setScissor: (x, y, w, h) => log.push(['scissor', x, y, w, h]),
    setClearColor: (c, a) => log.push(['clearColor', c, a]),
    clear: (...a) => log.push(['clear', ...a]),
    render: (scene, cam) => {
      const u = scene.children[0]?.material?.uniforms;
      log.push(['render', u?.uOff ? [u.uOff.value.x, u.uOff.value.y, u.uScl.value.x, u.uScl.value.y] : scene.children.length, cam]);
    },
  };
  return { renderer, log };
}

/** A Storage in memory. */
export function memoryStorage(seed = {}) {
  const m = new Map(Object.entries(seed));
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k), keys: () => [...m.keys()], map: m };
}

// The words that identify a client, a venue, an exhibition, a vendor or a private project. Kept encoded, so this file
// itself never contains them and a search of the repository for them finds nothing.
const enc = (s) => Buffer.from(s, 'base64').toString('utf8');
export const FORBIDDEN = [
  'cG9yc2NoZQ==', '5L+d5pmC5o23', 'dGFveXVhbg==', '5qGD5ZyS', '5rC05YuZ', '55Kw5L+d5bGA', 'bW9ub2xhYg==', '6Kit6KiI5bGV', 'ZGVzaWduIGV4cG8=',
  'em9uZTE=', 'em9uZSAx', 'ZmllbGR0ZXN0', 'Y2hleXV3dQ==', 'YXJ0LXRlcnJhaW4=', 'd2VhdmluZw==', 'Y3ltYXRpY3M=', 'YXJ0LWVvaQ==', 'bGlnaHQtZGluaW5n',
  '5pmC5YWJ6Zqn6YGT', '5ZOy5a6H', 'b2JzaWRpYW4=', 'cGxheWJvb2s=', 'MTPooYw=', 'd2F0ZXIz', 'Y2hpZWYtMTAxOQ==',
  'MTIwOTY=', 'MTA5NA==', 'MTU0MA==', 'MzI2NA==', 'OTgwMg==', 'MTk1NDZmNg==', 'NjAyZDIzMg==', 'MDVlZmJjZg==', 'OTNmYzQ2Mg==', 'ZDZmNGMyMWU=',
  'ZmRiOTg0OGM=', 'MzQyYjllNjk=', 'MTY2N2Y1ZWY=', 'Zjk5M2Y4Ng==',
].map(enc);
/** The same, as whole words only (they are short, and parts of ordinary words). */
export const FORBIDDEN_WORDS = ['bXVzZQ==', 'amV2'].map(enc);
/** Case matters for this one. */
export const FORBIDDEN_CASED = ['RU9J'].map(enc);

const AUTHOR_URL = new RegExp(`https://${enc('Y2hleXV3dQ==')}\\.com/(#person)?`, 'g');

/** Every forbidden word in a text, as [word, line number]. The author's own address in the JSON-LD a generator writes is not a hit. */
export function forbiddenIn(text) {
  const t = String(text).replace(AUTHOR_URL, '');
  const hits = [];
  const lines = t.split('\n');
  lines.forEach((line, i) => {
    const low = line.toLowerCase();
    for (const w of FORBIDDEN) if (low.includes(w.toLowerCase())) hits.push([w, i + 1]);
    for (const w of FORBIDDEN_WORDS) if (new RegExp(`\\b${w}\\b`, 'i').test(line)) hits.push([w, i + 1]);
    for (const w of FORBIDDEN_CASED) if (line.includes(w)) hits.push([w, i + 1]);
  });
  return hits;
}
