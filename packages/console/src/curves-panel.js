// Curves panel — the whole night's automation on the desk.
//
// One curve for every param that has automation, across the whole show (the same axis as the scrubber above it), with the
// segment boundaries and ids behind them, the playhead on each curve, and — when a slider, a mapped knob or a phone has taken
// a param away from its curve — an amber dot where it was taken to, the row marked, and ↩ to give it back. "↩ all" gives back
// every curve in the view. Press or drag anywhere on a curve or on the ruler to seek, exactly as on the scrubber.
//
// What a director needs from it: "what is this param going to do, and did I leave something grabbed?" — answered without
// opening the world's code, for any work, because it reads only the timeline and the params. The work is never named here.
//
// Cost, because it sits on a desk that runs at 60 Hz next to a world that wants the frame:
//   · closed (the default): render() returns after one class check. Nothing is measured, sampled or drawn.
//   · open: each row has two stacked canvases. The curve layer (.cv-base) is drawn when curveSignature() changes — an import,
//     a recorded take, an edited keyframe, another cut, a new width — and never otherwise. The other layer (.cv-over) holds
//     the playhead and the override and is redrawn every frame. Rows outside the scroll window are neither drawn nor cleared.
//   · text and classes are written only when they change (60 DOM writes a second would swallow clicks).
// The panel opens with its header (like every panel) or with the `curves` key (C; mountConsole's { keys }, so it moves and can be off).
import {
  hasCurves, curveParams, curveAxis, axisTime, curveBands, sampleCurve, levelOf, plotY, keyframeMarks, takePoints, curveCursor,
  curveSignature, overriddenKeys, clearOverrides, visibleRows, fmtValue, fmtClock,
} from './curves.js?v=72212d8';

const HEAD_H = 18, PLOT_H = 36, ROW_H = HEAD_H + PLOT_H + 4;   // a row: label, value and ↩ above; the plot below; 4 px between
const RULER_H = 22;
const MARGIN = 1;                                               // rows drawn beyond the scroll window, so a scroll shows no blank
// Lane colours: by place in the list, none of them near the amber that means "overridden". The work chooses none of this.
const PALETTE = ['#7ea6ff', '#37c978', '#b47ee6', '#ff8ad8', '#6fd3ff', '#9be37a', '#4fd1c5', '#b9a2ff'];
const AMBER = '#ffb02e', TAKE = '#ff4d5e';
const TAU = Math.PI * 2;

/** `text` that fits in `maxW` px with the context's current font: whole, or cut with …, or '' when fewer than two letters would show. */
function fitText(ctx, text, maxW) {
  if (maxW <= 0) return '';
  if (ctx.measureText(text).width <= maxW) return text;
  for (let n = text.length - 1; n >= 2; n--) if (ctx.measureText(text.slice(0, n) + '…').width <= maxW) return text.slice(0, n) + '…';
  return '';
}

/**
 * @param {HTMLElement} root   the desk
 * @param {object} app         { timeline, params, … } as mountConsole gets it
 * @param {object} keys        the resolved key map (to print the key in the tooltip)
 * @param {{ open?: boolean }} [o]
 * @returns the panel's handle, or null when there is no timeline to read
 */
export function buildCurvesPanel(root, app, keys = {}, o = {}) {
  const { timeline, params } = app;
  if (!timeline || typeof timeline.valueAt !== 'function' || !params?.schema) return null;
  const keyHint = keys.curves?.[0]?.label;

  const panel = document.createElement('div');
  panel.className = 'oav-panel oav-curves' + (o.open ? '' : ' closed');
  panel.hidden = true;                                           // shown as soon as there is something to show
  panel.innerHTML = `<h3></h3>
    <div class="cv-bar"><span class="cv-sum"></span><button class="oav-chip" data-all disabled>↩ all</button></div>
    <div class="cv-scroll"><div class="cv-rows"></div></div>`;
  root.appendChild(panel);
  const h3 = panel.querySelector('h3');
  h3.textContent = 'Curves';                                       // plain text: the header toggles only when the click lands on the h3 itself
  h3.title = 'the automation of every param across the whole show' + (keyHint ? ` (${keyHint})` : '');
  const sumEl = panel.querySelector('.cv-sum'), allBtn = panel.querySelector('[data-all]');
  const scroll = panel.querySelector('.cv-scroll'), rowsEl = panel.querySelector('.cv-rows');
  // The ruler and the rows (with their canvases) are made the first time the panel is open: a closed one holds no canvas at all.
  let ruler = null, ruler2 = null;
  function ensureRuler() {
    if (ruler) return;
    ruler = document.createElement('div');
    ruler.className = 'cv-ruler'; ruler.title = 'click or drag to move the playhead';
    ruler.innerHTML = '<canvas class="cv-base"></canvas><canvas class="cv-over"></canvas>';
    scroll.insertBefore(ruler, rowsEl);
    ruler2 = { base: ruler.querySelector('.cv-base'), over: ruler.querySelector('.cv-over'), sizeVer: -1, drawnVer: -1 };
    ruler2.bctx = ruler2.base.getContext('2d'); ruler2.octx = ruler2.over.getContext('2d');
  }

  // ── state ──
  const stats = { rebuilds: 0, baseDraws: 0, overDraws: 0 };     // for tests and devtools: how often each layer was really painted
  let curves = [], axis = curveAxis(timeline), bands = [], rowList = [];
  const rows = new Map();                                        // key → row
  let lastSig = null, ver = 0, sizeVer = 0, W = 0, dpr = 1, viewH = 0, scrollTop = 0;
  let sizeDirty = true, wasOpen = false, probe = 0, drag = null;
  const last = { sum: '', all: null, allTitle: '' };

  const isClosed = () => panel.classList.contains('closed');
  const isOpen = () => !panel.hidden && !isClosed();
  const syncVisible = () => { const has = hasCurves(params, timeline); if (panel.hidden === has) panel.hidden = !has; };
  syncVisible();

  // ── rows ──
  function makeRow(p) {
    const el = document.createElement('div');
    el.className = 'cv-row'; el.dataset.key = p.key;
    el.innerHTML = `<div class="cv-head"><b></b><span class="val"></span><button class="oav-chip" data-clear hidden>↩</button></div>
      <div class="cv-plot" title="click or drag to move the playhead"><canvas class="cv-base" role="img"></canvas><canvas class="cv-over"></canvas></div>`;
    const row = { el, p, label: el.querySelector('b'), val: el.querySelector('.val'), clear: el.querySelector('[data-clear]'),
      base: el.querySelector('.cv-base'), over: el.querySelector('.cv-over'), sizeVer: -1, drawnVer: -1, ovr: false, text: '', color: PALETTE[0] };
    row.bctx = row.base.getContext('2d'); row.octx = row.over.getContext('2d');
    return row;
  }
  function describe(row, p, i) {
    row.p = p;
    row.color = PALETTE[i % PALETTE.length];
    row.el.style.setProperty('--c', row.color);
    row.label.textContent = p.label; row.label.title = p.key;
    row.clear.title = `give ${p.label} back to its curve`; row.clear.setAttribute('aria-label', row.clear.title);
    row.base.setAttribute('aria-label', `${p.label} across the show`);
  }

  // the list of curves changed (or their shapes did): rebuild what depends on it. Rare — an import, a take, another cut.
  function rebuild() {
    stats.rebuilds++;
    curves = curveParams(params, timeline);
    axis = curveAxis(timeline);
    bands = curveBands(timeline, axis);
    ver++;
    const keep = new Set(curves.map((p) => p.key));
    for (const [k, row] of rows) if (!keep.has(k)) { row.el.remove(); rows.delete(k); }
    rowList = curves.map((p, i) => {
      let row = rows.get(p.key);
      if (!row) { row = makeRow(p); rows.set(p.key, row); }
      describe(row, p, i);
      rowsEl.appendChild(row.el);                                // appending a child already there moves it: this keeps the declared order
      return row;
    });
    if (bands.length) { ensureRuler(); ruler.hidden = false; ruler2.drawnVer = -1; } else if (ruler) ruler.hidden = true;
    panel.hidden = !curves.length;
    sizeDirty = true;
  }

  function measure() {
    const w = Math.floor(scroll.clientWidth), d = Math.min(2, window.devicePixelRatio || 1);
    viewH = scroll.clientHeight; scrollTop = scroll.scrollTop;
    if (w !== W || d !== dpr) { W = w; dpr = d; sizeVer++; ver++; }
  }

  function fit(item, h, ctxs) {                                  // (re)size a pair of canvases to the current width, once per width
    if (item.sizeVer === sizeVer) return;
    for (const c of [item.base, item.over]) { c.width = Math.max(1, Math.round(W * dpr)); c.height = Math.max(1, Math.round(h * dpr)); }
    for (const x of ctxs) x.setTransform(dpr, 0, 0, dpr, 0, 0);
    item.sizeVer = sizeVer; item.drawnVer = -1;
  }

  // ── the cached layer: segment bands, the curve, its keyframes ──
  function paintBands(ctx, h, withLabels) {
    for (const b of bands) {
      const x0 = b.x0 * W, x1 = b.x1 * W;
      if (b.index % 2) { ctx.fillStyle = 'rgba(255,255,255,.035)'; ctx.fillRect(x0, 0, x1 - x0, h); }
      if (b.x0 > 0) { const x = Math.round(x0) + 0.5; ctx.strokeStyle = '#2a3348'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke(); }
      if (b.hold && b.x1 < 1) {                                  // a hold: the show waits here (dashed gold, as on the scrubber)
        const x = Math.round(x1) - 0.5; ctx.strokeStyle = '#ffd166'; ctx.lineWidth = 1.5; ctx.setLineDash([3, 3]);
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke(); ctx.setLineDash([]);
      }
      if (withLabels) {                                          // the id, cut short with … when the band is narrow, left out when almost nothing fits (hover says it)
        const text = fitText(ctx, b.id, x1 - x0 - 8);
        if (text) { ctx.fillStyle = '#8892a8'; ctx.fillText(text, x0 + 5, h / 2 + 1); }
      }
    }
  }
  function drawRulerBase() {
    const ctx = ruler2.bctx;
    ctx.clearRect(0, 0, W, RULER_H);
    ctx.font = '10px ui-monospace, SFMono-Regular, Menlo, monospace'; ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
    paintBands(ctx, RULER_H, true);
    stats.baseDraws++;
  }
  function drawBase(row) {
    const ctx = row.bctx, p = row.p, h = PLOT_H;
    ctx.clearRect(0, 0, W, h);
    paintBands(ctx, h, false);
    ctx.strokeStyle = '#141a29'; ctx.lineWidth = 1;              // the range: a hairline at the bottom and the top
    for (const lv of [0, 1]) { const y = Math.round(plotY(lv, h)) + 0.5; ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
    // the curve: timeline.valueAt over the axis, about one sample per pixel
    const n = Math.max(8, Math.min(2400, Math.ceil(W))), vs = sampleCurve(timeline, p.key, axis, n);
    const line = new Path2D();
    for (let i = 0; i <= n; i++) { const x = (i / n) * W, y = plotY(levelOf(p, vs[i]), h); if (i) line.lineTo(x, y); else line.moveTo(x, y); }
    const area = new Path2D(line);
    area.lineTo(W, plotY(0, h)); area.lineTo(0, plotY(0, h)); area.closePath();
    ctx.fillStyle = row.color; ctx.globalAlpha = 0.1; ctx.fill(area);
    ctx.globalAlpha = 0.95; ctx.strokeStyle = row.color; ctx.lineWidth = 1.6; ctx.lineJoin = 'round'; ctx.stroke(line);
    // the keyframes (a square where the segment arrives by a step), unless there are too many to read
    const marks = keyframeMarks(timeline, p.key, axis);
    if (marks.length <= W / 6) {
      ctx.fillStyle = row.color; ctx.globalAlpha = 0.9;
      for (const m of marks) {
        const x = m.x * W, y = plotY(levelOf(p, m.v), h);
        if (m.kind === 'step') ctx.fillRect(x - 2.5, y - 2.5, 5, 5); else { ctx.beginPath(); ctx.arc(x, y, 2.2, 0, TAU); ctx.fill(); }
      }
    }
    ctx.globalAlpha = 1;
    stats.baseDraws++;
  }

  // ── the per-frame layer: the playhead, the override, the take being recorded ──
  const cursorX = (x) => Math.min(W - 0.5, Math.max(0.5, Math.round(x * W) + 0.5));
  function drawRulerOver() {
    const ctx = ruler2.octx;
    ctx.clearRect(0, 0, W, RULER_H);
    const b = bands[timeline.sceneIndexAt()];
    if (b) { ctx.fillStyle = 'rgba(46,109,246,.28)'; ctx.fillRect(b.x0 * W, 0, (b.x1 - b.x0) * W, RULER_H); }
    const x = cursorX(Math.min(1, Math.max(0, (timeline.t - axis.lo) / axis.span)));
    ctx.strokeStyle = 'rgba(255,255,255,.9)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, RULER_H); ctx.stroke();
    stats.overDraws++;
  }
  function drawOver(row, state) {
    const ctx = row.octx, p = row.p, h = PLOT_H;
    const c = curveCursor({ timeline, params, p, state, axis });
    ctx.clearRect(0, 0, W, h);
    const x = cursorX(c.x), yAt = plotY(c.yAt, h);
    if (c.overridden) {                                          // where it was taken: a line across the show, and the dot at the playhead
      const yO = plotY(c.yOver, h);
      ctx.save(); ctx.globalAlpha = 0.5; ctx.strokeStyle = AMBER; ctx.lineWidth = 1; ctx.setLineDash([4, 3]);
      ctx.beginPath(); ctx.moveTo(0, yO); ctx.lineTo(W, yO); ctx.stroke();
      ctx.setLineDash([2, 2]); ctx.beginPath(); ctx.moveTo(x, yAt); ctx.lineTo(x, yO); ctx.stroke(); ctx.restore();
    }
    const take = takePoints(timeline, p.key, axis);
    if (take.length) {                                           // recording: what the curve is about to become, over the override's guide it usually lies on
      ctx.strokeStyle = TAKE; ctx.lineWidth = 2; ctx.beginPath();
      take.forEach((q, i) => { const px = q.x * W, py = plotY(levelOf(p, q.v), h); if (i) ctx.lineTo(px, py); else ctx.moveTo(px, py); });
      ctx.stroke();
    }
    ctx.strokeStyle = 'rgba(255,255,255,.9)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
    // where the curve is now: a ring (hollow when something else holds the param, filled with the lane colour when the curve is in charge)
    ctx.beginPath(); ctx.arc(x, yAt, 4, 0, TAU);
    if (!c.overridden) { ctx.fillStyle = row.color; ctx.fill(); }
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5; ctx.stroke();
    if (c.overridden) { ctx.fillStyle = AMBER; ctx.beginPath(); ctx.arc(x, plotY(c.yOver, h), 4.5, 0, TAU); ctx.fill(); }
    stats.overDraws++;
  }

  // ── seek: press or drag on a curve or the ruler, the scrubber's convention (it keeps playing; drag past the edge = the end) ──
  scroll.addEventListener('pointerdown', (e) => {
    const target = e.target.closest?.('.cv-plot, .cv-ruler');
    if (!target || (e.button && e.button > 0)) return;
    const seek = (ev) => {
      const r = target.getBoundingClientRect();
      if (r.width > 0) timeline.seek(axisTime(axis, (ev.clientX - r.left) / r.width));
    };
    const off = () => { window.removeEventListener('pointermove', seek); window.removeEventListener('pointerup', off); window.removeEventListener('pointercancel', off); drag = null; };
    drag?.();
    seek(e);
    window.addEventListener('pointermove', seek); window.addEventListener('pointerup', off); window.addEventListener('pointercancel', off);
    drag = off;
  });
  // hover: which segment and what time the pointer is over (a band too narrow for its id still gets named)
  scroll.addEventListener('pointermove', (e) => {
    const target = e.target.closest?.('.cv-plot, .cv-ruler');
    if (!target) return;
    const r = target.getBoundingClientRect();
    if (!(r.width > 0)) return;
    const T = axisTime(axis, (e.clientX - r.left) / r.width);
    const b = bands.find((x) => T >= x.t0 && T < x.t1) || bands[bands.length - 1];
    const text = `${b ? b.id + ' · ' : ''}${fmtClock(T)} — click or drag to move the playhead`;
    if (target.title !== text) target.title = text;
  });
  scroll.addEventListener('scroll', () => { scrollTop = scroll.scrollTop; });
  panel.addEventListener('click', (e) => {
    const b = e.target.closest?.('button');
    if (!b) return;
    if (b.hasAttribute('data-clear')) params.clearOverride(b.closest('.cv-row').dataset.key);
    else if (b.hasAttribute('data-all')) clearOverrides(params, overriddenKeys(params, curves));
  });
  const ro = typeof ResizeObserver === 'function' ? new ResizeObserver(() => { sizeDirty = true; }) : null;
  ro?.observe(scroll);

  const set = (el, key, text) => { if (last[key] !== text) { last[key] = text; el.textContent = text; } };

  // ── per frame ──
  function render(state) {
    if (isClosed()) {                                            // closed: nothing is measured, sampled or drawn
      wasOpen = false;
      if (probe++ % 30 === 0) syncVisible();                     // only whether there is anything to head (no drawing)
      return;
    }
    if (!wasOpen) { wasOpen = true; sizeDirty = true; }          // opened (or reopened): look at the width again; the curves are kept if nothing changed
    const sig = curveSignature(timeline, params);
    if (sig !== lastSig) { lastSig = sig; rebuild(); }
    if (panel.hidden) return;
    if (Math.min(2, window.devicePixelRatio || 1) !== dpr) sizeDirty = true;
    if (sizeDirty) { sizeDirty = false; measure(); }
    if (!W) return;                                              // not laid out (yet)

    // heads: only text and classes that changed
    const over = overriddenKeys(params, curves);
    for (const row of rowList) {
      const k = row.p.key, ovr = over.includes(k);
      if (row.ovr !== ovr) { row.ovr = ovr; row.el.classList.toggle('ovr', ovr); row.clear.hidden = !ovr; }
      const v = state?.[k];
      const text = fmtValue(typeof v === 'number' ? v : timeline.valueAt(k));
      if (row.text !== text) { row.text = text; row.val.textContent = text; }
    }
    set(sumEl, 'sum', `${curves.length} curve${curves.length === 1 ? '' : 's'}${over.length ? ` · ${over.length} overridden` : ''}`);
    if (last.all !== !over.length) { last.all = !over.length; allBtn.disabled = !over.length; }
    const allTitle = over.length ? `give ${over.length} param${over.length === 1 ? '' : 's'} back to their curves` : 'nothing is overridden';
    if (last.allTitle !== allTitle) { last.allTitle = allTitle; allBtn.title = allTitle; }

    // paint: the ruler, and the rows in the scroll window
    if (bands.length) {
      fit(ruler2, RULER_H, [ruler2.bctx, ruler2.octx]);
      if (ruler2.drawnVer !== ver) { drawRulerBase(); ruler2.drawnVer = ver; }
      drawRulerOver();
    }
    const [from, to] = visibleRows(scrollTop, viewH, ROW_H, rowList.length, MARGIN);
    for (let i = from; i <= to; i++) {
      const row = rowList[i];
      fit(row, PLOT_H, [row.bctx, row.octx]);
      if (row.drawnVer !== ver) { drawBase(row); row.drawnVer = ver; }
      drawOver(row, state);
    }
  }

  return {
    el: panel,
    get open() { return isOpen(); },
    /** Open or close (no argument: flip). Does nothing while there is no curve to show. Returns whether it is open. */
    toggle(force) {
      if (panel.hidden) return false;
      panel.classList.toggle('closed', force === undefined ? !isClosed() : !force);
      return isOpen();
    },
    render,
    /** What it is showing, as plain data (tests, devtools): the curves, the bands, the axis, and how often each layer was painted. */
    info() {
      return {
        open: isOpen(), keys: curves.map((p) => p.key), axis: { ...axis }, width: W, dpr,
        bands: bands.map(({ id, title, t0, t1, x0, x1, hold }) => ({ id, title, t0, t1, x0, x1, hold })),
        geometry: { rowH: ROW_H, plotH: PLOT_H, rulerH: RULER_H },
        stats: { ...stats },
      };
    },
    dispose() { drag?.(); ro?.disconnect(); },
  };
}
