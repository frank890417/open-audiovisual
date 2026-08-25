// @openav/stage — the world shell (system layer).
//
// A World is any algorithmic system with this lifecycle:
//
//   export const myWorld = {
//     name: 'garden',
//     params: [{ key:'growth', min:0, max:1, def:0.5, label:'Growth' }, …],
//     init(ctx)            // ctx = { container, canvas?, signals, params }
//     update(dt, state, io) // state = resolved param values; io = { signals, midi?, osc? }
//     render()             // draw. Renderer-agnostic: p5, three, 2D canvas, DOM, SVG…
//     dispose()            // release GPU/DOM resources
//   }
//
// The Stage owns the lifecycle and param aggregation; it deliberately does NOT
// own a renderer. The framework has no opinion about p5 vs three vs canvas —
// that neutrality is the whole point of the system layer.
//
// Constitutional rule (from The Last Input): the shell never knows the work.
// Switching works = swapping World + data; the shell stays.

export class Stage {
  /**
   * @param {object} deps
   * @param {HTMLElement} deps.container
   * @param {import('../core/src/params.js?v=0c76e80').Params} deps.params
   * @param {import('../core/src/signals.js?v=0c76e80').Signals} deps.signals
   * @param {object} [deps.io] extra io handles passed to update (midi, osc…)
   */
  constructor({ container, params, signals, io = {} }) {
    this.container = container;
    // worlds live in their own layer so activate() can clear it without nuking
    // overlays (hints, start buttons) that share the container
    this.layer = document.createElement('div');
    this.layer.style.cssText = 'position:absolute;inset:0;';
    if (getComputedStyle(container).position === 'static') container.style.position = 'relative';
    container.prepend(this.layer);
    this.params = params;
    this.signals = signals;
    this.io = { signals, ...io };
    this.worlds = new Map();
    this.active = null;
    this.activeName = '';
  }

  /** Register a world and absorb its param schema. */
  register(world) {
    this.worlds.set(world.name, world);
    if (world.params) this.params.add(world.params);
    return this;
  }

  /** Switch active world (disposes the previous one). */
  async activate(name) {
    if (this.activeName === name) return;
    if (this.active?.dispose) { try { this.active.dispose(); } catch (e) { console.error('[stage] dispose:', e); } }
    this.layer.innerHTML = '';
    const world = this.worlds.get(name);
    if (!world) throw new Error(`[stage] unknown world: ${name}`);
    this.active = world;
    this.activeName = name;
    await world.init?.({ container: this.layer, signals: this.signals, params: this.params });
  }

  /** Per-frame: resolve params → world.update → world.render. */
  frame(dt, baseState) {
    if (!this.active) return null;
    const state = this.params.resolve(baseState);
    try { this.active.update?.(dt, state, this.io); } catch (e) { console.error('[stage] update:', e); }
    try { this.active.render?.(); } catch (e) { console.error('[stage] render:', e); }
    return state;
  }
}

/** Convenience: a 2D canvas that tracks its container size. Worlds may use or ignore it. */
export function createCanvas(container, { alpha = false } = {}) {
  const canvas = document.createElement('canvas');
  canvas.style.cssText = 'display:block;width:100%;height:100%;';
  container.appendChild(canvas);
  const ctx = canvas.getContext('2d', { alpha });
  const fit = () => {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = container.clientWidth, h = container.clientHeight;
    if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
      canvas.width = w * dpr; canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    return { w, h };
  };
  fit();
  const ro = new ResizeObserver(fit);
  ro.observe(container);
  return { canvas, ctx, fit, dispose: () => { ro.disconnect(); canvas.remove(); } };
}
