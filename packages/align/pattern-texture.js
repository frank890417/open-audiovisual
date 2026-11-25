// @openav/align · pattern-texture — a test pattern drawn on the ART canvas (artView: one tile per segment, dst = src) as a
// texture, so it goes through the same warp as the work: a pattern that is right on the wall means the work is right,
// one warp later. THREE and document are passed in by the caller.
import { artView } from './mapping.js?v=7229c5d3';
import { drawPattern } from './patterns.js?v=7229c5d3';
import { drawIdentBase, drawIdentLive } from './ident.js?v=7229c5d3';

/** What the align mode can show: 'live' is the work itself (the caller gives it), the rest are patterns and flat colours. */
export const PATTERN_SOURCES = ['live', 'ident', 'tiles', 'grid', 'edges', 'crosshair', 'bars:smpte', 'bars:steps', 'bars:ramp', 'white', 'gray50', 'black'];
/** Their names, in English and Chinese. */
export const SOURCE_LABELS = {
  en: {
    live: 'the work', ident: 'identify (surface names, sides, the sweep)', tiles: 'cells', grid: 'grid and art coordinates', edges: 'edges and corners', crosshair: 'crosshair',
    'bars:smpte': 'SMPTE bars', 'bars:steps': 'grey steps', 'bars:ramp': 'ramp', white: 'white (even brightness)', gray50: 'grey 50 % (the blend bands)', black: 'black (light leaks)',
  },
  zh: {
    live: '作品', ident: '認機（面名、方位、光帶）', tiles: '逐格座標', grid: '格線＋作品座標', edges: '邊框四角', crosshair: '十字圓',
    'bars:smpte': '色條 SMPTE', 'bars:steps': '灰階階梯', 'bars:ramp': '連續漸層', white: '全白（看亮度均勻）', gray50: '灰 50%（看融接帶）', black: '全黑（看漏光）',
  },
};

/**
 * Paint one source over an art-canvas 2D context: 'white', 'gray50', 'black', 'ident', or a pattern with its variant ('bars:steps').
 * @param {CanvasRenderingContext2D} g
 * @param {object} mapping
 * @param {string} source
 */
export function drawSource(g, mapping, source, { lang = 'en' } = {}) {
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.fillStyle = '#000'; g.fillRect(0, 0, mapping.art.w, mapping.art.h);
  const view = artView(mapping);
  if (source === 'white' || source === 'gray50') {
    g.fillStyle = source === 'white' ? '#fff' : '#808080';
    for (const t of view.tiles) g.fillRect(t.src.x, t.src.y, t.src.w, t.src.h);
  } else if (source === 'ident') {
    drawIdentBase(g, mapping, { lang });
  } else if (source !== 'black') {
    const [pattern, variant] = source.split(':');
    drawPattern(g, view, pattern, { variant, lang });
  }
}

/**
 * A three.js CanvasTexture of the art canvas's size that a source is painted into, redrawn only when the source changes
 * (the ident screen's sweep and clock at 15 fps on top of a base drawn once).
 * @param {object} THREE    the three.js module
 * @param {{w:number,h:number}} size  the art canvas
 * @param {Document} [doc]
 * @returns {{ canvas:HTMLCanvasElement, texture:object, draw(mapping:object, source:string, t?:number):object, dispose():void }}
 */
export function createPatternTexture(THREE, size, doc = globalThis.document, { lang = 'en' } = {}) {
  const canvas = doc.createElement('canvas');
  canvas.width = size.w; canvas.height = size.h;
  const texture = new THREE.CanvasTexture(canvas);
  if ('NoColorSpace' in THREE) texture.colorSpace = THREE.NoColorSpace;
  texture.minFilter = THREE.LinearFilter; texture.generateMipmaps = false;
  let key = null, base = null, tick = -1;
  return {
    canvas, texture,
    /** t, in seconds, is for the ident screen only */
    draw(mapping, source, t = 0) {
      const k = `${mapping.id}|${mapping.art.w}|${source}`;
      if (source === 'ident') {
        if (k !== key) { key = k; base ??= doc.createElement('canvas'); base.width = size.w; base.height = size.h; drawIdentBase(base.getContext('2d'), mapping, { lang }); tick = -1; }
        const f = Math.floor(t * 15);
        if (f !== tick) { tick = f; const g = canvas.getContext('2d'); g.setTransform(1, 0, 0, 1, 0, 0); g.drawImage(base, 0, 0); drawIdentLive(g, mapping, t, { lang }); texture.needsUpdate = true; }
        return texture;
      }
      if (k !== key) { key = k; drawSource(canvas.getContext('2d'), mapping, source, { lang }); texture.needsUpdate = true; }
      return texture;
    },
    dispose() { texture.dispose(); },
  };
}
