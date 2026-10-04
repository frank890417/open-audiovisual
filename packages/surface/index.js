// @openav/surface — a TouchOSC-style control surface for phones and iPads.
//
//   import { Surface, autoSurface, signalSink } from '@openav/surface';
//
//   const surface = new Surface(el, {
//     layout,                                   // layout JSON (see layout.js)
//     sink: (name, value, info) => relay.set(name, value),   // where signals go
//   });
//   surface.feedback('surface/main/level', 0.4); // runner → widget (meters, fader echo)
//
// Three ideas:
//   1. WIDGETS are dumb: fingers in, named normalized signals out (widgets.js).
//   2. LAYOUT is data: pages → grid → widgets, with portrait/landscape variants
//      and an auto-reflow when none is given (layout.js).
//   3. THEME is one set of CSS variables, so every control feels like the same
//      instrument (theme.js).
// The surface never knows the work. A World's `params` can grow a whole panel
// by themselves (autoSurface, auto.js) — which is AGENTS.md rule #1 paying off.

import { injectTheme } from './theme.js?v=062bc76';
import { WIDGET_CLASSES } from './widgets.js?v=062bc76';
import { normalizeLayout, resolvePage, validateLayout, orientationOf } from './layout.js?v=062bc76';
import { haptic } from './platform.js?v=062bc76';

export { autoSurface, feedbackFor, widgetTypeFor, routesFromLayout } from './auto.js?v=062bc76';
export { normalizeLayout, resolvePage, validateLayout, autoArrange, signalNames, DEFAULT_SIZE, WIDGET_TYPES } from './layout.js?v=062bc76';
export { planKeyboard } from './kbplan.js?v=062bc76';
export { lockViewport, keepAwake, toggleFullscreen, canFullscreen, haptic } from './platform.js?v=062bc76';
export { injectTheme, THEME_VARS, COLOR_NAMES } from './theme.js?v=062bc76';
export { WIDGET_CLASSES } from './widgets.js?v=062bc76';

/** A sink that writes straight into a local Signals registry — a surface
 *  on the same page as the show (no phone, no relay). */
export function signalSink(signals) {
  return (name, value, info = {}) => {
    if (info.pulse) { if (!signals.meta.has(name)) signals.define(name, { kind: 'pulse' }); signals.pulse(name, value); }
    else { if (!signals.meta.has(name)) signals.define(name, { min: 0, max: 1 }); signals.set(name, value); }
  };
}

export class Surface {
  /**
   * @param {HTMLElement} container
   * @param {object} o
   * @param {object} o.layout
   * @param {(name:string, value:any, info:{raw?:any, pulse?:boolean})=>void} o.sink
   * @param {boolean} [o.haptics=true]
   * @param {boolean} [o.tabs=true]          page tabs when there is more than one page
   * @param {'portrait'|'landscape'} [o.orientation]   force; default follows the container's shape
   * @param {(pageId:string)=>void} [o.onPage]
   */
  constructor(container, { layout, sink, haptics = true, tabs = true, orientation = null, onPage = null } = {}) {
    injectTheme();
    this.container = container;
    this.sink = sink || (() => {});
    this.haptics = haptics; this.showTabs = tabs; this.forced = orientation; this.onPage = onPage;
    this.root = document.createElement('div');
    this.root.className = 'oav-surface';
    container.appendChild(this.root);
    this.widgets = new Map();       // "page/id" -> Widget
    this._fb = new Map();           // full signal name -> handler(s)
    this._cells = [];               // [{page, widget, cell}]
    this.orientation = 'landscape';
    this.pageId = null;
    this._ro = new ResizeObserver((es) => {
      for (const e of es) {
        if (e.target === this.root) { this._orient(e.contentRect.width, e.contentRect.height); continue; }
        const w = e.target._widget; if (w && e.contentRect.width) w.resize(e.contentRect.width, e.contentRect.height);
      }
    });
    if (layout) this.setLayout(layout);
    this._ro.observe(this.root);
  }

  /** (Re)build from layout JSON. Throws on an invalid layout, listing every problem. */
  setLayout(raw) {
    const errs = validateLayout(raw);
    if (errs.length) throw new Error('invalid surface layout:\n  ' + errs.join('\n  '));
    this.disposeWidgets();
    this.layout = normalizeLayout(raw);
    this.root.innerHTML = '';
    const pages = this.layout.pages;
    this.tabsEl = null;
    if (pages.length > 1 && this.showTabs) {
      this.tabsEl = document.createElement('div'); this.tabsEl.className = 'oav-tabs';
      for (const p of pages) {
        const b = document.createElement('button'); b.className = 'oav-tab'; b.textContent = p.title; b.dataset.page = p.id; b.type = 'button';
        b.addEventListener('pointerdown', (e) => { e.preventDefault(); this.setPage(p.id); });
        this.tabsEl.appendChild(b);
      }
      this.root.appendChild(this.tabsEl);
    }
    this.pagesEl = document.createElement('div'); this.pagesEl.className = 'oav-pages';
    this.root.appendChild(this.pagesEl);
    for (const p of pages) {
      const pe = document.createElement('div'); pe.className = 'oav-page'; pe.dataset.page = p.id;
      this.pagesEl.appendChild(pe);
      const ctx = {
        page: p.id,
        out: (name, value, info = {}) => this._out(name, value, info),
        haptic: (ms) => haptic(ms, this.haptics),
      };
      for (const spec of p.widgets) {
        const Cls = WIDGET_CLASSES[spec.type];
        const w = new Cls(spec, ctx);
        const cell = document.createElement('div'); cell.className = 'oav-cell'; cell.appendChild(w.el);
        w.el._widget = w; pe.appendChild(cell);
        this.widgets.set(`${p.id}/${spec.id}`, w);
        this._cells.push({ page: p, widget: w, cell });
        this._ro.observe(w.el);
        for (const [name, fn] of w.feedbackTargets()) this._fb.set(name, fn);
      }
    }
    this.setPage(this.pageId && pages.some((p) => p.id === this.pageId) ? this.pageId : pages[0].id);
    this._applyLayout();
    return this;
  }

  _out(name, value, info) {
    this.sink(name, value, info);
    // raw value rides beside the normalized one — only when they differ, so 0..1 widgets cost nothing extra
    if (info.raw !== undefined && info.raw !== value) this.sink(name + '/raw', info.raw, {});
  }

  _orient(w, h) {
    const o = this.forced || orientationOf(w, h);
    if (o !== this.orientation) { this.orientation = o; this._applyLayout(); }
  }

  /** Place every cell for the current orientation. Percent geometry: no per-resize math. */
  _applyLayout() {
    if (!this.layout) return;
    for (const p of this.layout.pages) {
      const res = resolvePage(p, this.orientation);
      const pe = this.pagesEl.querySelector(`.oav-page[data-page="${p.id}"]`);
      pe.dataset.layout = res.source;
      const at = new Map(res.placements.map((q) => [q.id, q]));
      for (const c of this._cells) {
        if (c.page !== p) continue;
        const q = at.get(c.widget.id); if (!q) continue;
        const s = c.cell.style;
        s.left = (q.x / res.grid.cols) * 100 + '%'; s.top = (q.y / res.grid.rows) * 100 + '%';
        s.width = (q.w / res.grid.cols) * 100 + '%'; s.height = (q.h / res.grid.rows) * 100 + '%';
      }
    }
    this.root.dataset.orientation = this.orientation;
    for (const c of this._cells) if (c.widget.el.offsetWidth) c.widget.resize(c.widget.el.offsetWidth, c.widget.el.offsetHeight);
  }

  setPage(id) {
    this.pageId = id;
    for (const pe of this.pagesEl.children) pe.classList.toggle('on', pe.dataset.page === id);
    this.tabsEl?.querySelectorAll('.oav-tab').forEach((b) => b.classList.toggle('on', b.dataset.page === id));
    // widgets on a page that was display:none have no size; tell them now
    requestAnimationFrame(() => { for (const c of this._cells) if (c.page.id === id && c.widget.el.offsetWidth) c.widget.resize(c.widget.el.offsetWidth, c.widget.el.offsetHeight); });
    this.onPage?.(id);
  }

  /** Runner → widget. `name` is a full signal name like surface/main/level. */
  feedback(name, value) { this._fb.get(name)?.(value); }

  widget(page, id) { return this.widgets.get(`${page}/${id}`); }

  disposeWidgets() {
    for (const w of this.widgets.values()) { try { this._ro.unobserve(w.el); w.destroy(); } catch {} }
    this.widgets.clear(); this._fb.clear(); this._cells = [];
  }
  dispose() { this._ro.disconnect(); this.disposeWidgets(); this.root.remove(); }
}
