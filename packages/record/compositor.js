// compositor.js — Compositor: the work and the performer's camera in one canvas
// of an exact pixel size, redrawn every frame. The Recorder records this canvas.
//
// The output size is the file's size, never the window's: the work is drawn at
// 1080×1920 or 2160×3840 whatever the screen, so a vertical 4K take from a
// laptop is really 4K. Show the canvas scaled down with CSS for a preview.
//
// It never owns the work: getWorkCanvas() is asked for the work's canvas every
// frame (p5 may replace it; a WebGL work may resize it). It never owns the
// camera stream either: setCamera(null) lets go, the host stops the tracks.

import { layoutRects, resolveSize, LAYOUTS } from './layout.js?v=f860ae3';

const dims = (s) => {
  if (!s) return [0, 0];
  if (typeof s.videoWidth === 'number') return s.readyState >= 2 ? [s.videoWidth, s.videoHeight] : [0, 0];
  return [s.width || 0, s.height || 0];
};

function roundRectPath(ctx, x, y, w, h, r) {
  ctx.beginPath();
  if (typeof ctx.roundRect === 'function') { ctx.roundRect(x, y, w, h, r); return; }
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export class Compositor {
  /**
   * @param {object} opts
   * @param {string|{w:number,h:number}|number[]} [opts.size='vertical-1080p'] a PRESETS id, 'WxH', [w, h] or {w, h}
   * @param {'stack'|'pip'|'side'|'work'} [opts.layout='stack']
   * @param {object} [opts.layoutOptions] passed to layoutRects (fit, camFit, camAnchor, minCam, split, pip)
   * @param {() => (HTMLCanvasElement|CanvasImageSource|null)} opts.getWorkCanvas the work's canvas, asked every frame
   * @param {string} [opts.background='#000']
   * @param {boolean} [opts.mirrorCam=true] show the camera as a mirror (keep it equal to HandTracker's `mirror`)
   * @param {number} [opts.maxFps=60] draw at most this often (a 120 Hz display does not need 120 composites)
   * @param {(ctx: CanvasRenderingContext2D, rects: object, comp: Compositor) => void} [opts.onDraw] overlay hook, after work + camera
   * @param {HTMLCanvasElement} [opts.canvas] draw into this canvas instead of a new one
   */
  constructor({ size = 'vertical-1080p', layout = 'stack', layoutOptions = {}, getWorkCanvas = null, background = '#000',
    mirrorCam = true, maxFps = 60, onDraw = null, canvas = null } = {}) {
    this.canvas = canvas || document.createElement('canvas');
    this.ctx = this.canvas.getContext('2d', { alpha: false });
    this.getWorkCanvas = getWorkCanvas;
    this.background = background;
    this.mirrorCam = mirrorCam;
    this.maxFps = maxFps;
    this.onDraw = onDraw;
    this.layoutOptions = { ...layoutOptions };
    this.layout = 'stack';
    this.rects = null;
    this.running = false;
    this.frames = 0;
    this.fps = 0;
    this._cam = null;          // what is drawn: a <video> or any canvas-like source
    this._ownVideo = null;     // the <video> we made for a MediaStream
    this._key = '';
    this._lastDraw = -1e9; this._lastTick = 0;
    this._fpsN = 0; this._fpsAt = 0;
    this.setLayout(layout);
    this.setSize(size);
  }

  /** The output size `{ w, h }`. */
  get size() { return { w: this.canvas.width, h: this.canvas.height }; }

  /**
   * Change the output size (between takes: a recorder running on this canvas keeps its old size).
   * @param {string|{w:number,h:number}|number[]} size
   */
  setSize(size) {
    const { w, h } = resolveSize(size);
    if (this.canvas.width !== w) this.canvas.width = w;
    if (this.canvas.height !== h) this.canvas.height = h;
    this._key = '';
    return this;
  }

  /**
   * @param {'stack'|'pip'|'side'|'work'} layout
   * @param {object} [options] merged into layoutOptions
   */
  setLayout(layout, options) {
    if (!LAYOUTS.includes(layout)) throw new TypeError(`Compositor: unknown layout "${layout}" (${LAYOUTS.join(', ')})`);
    this.layout = layout;
    if (options) this.layoutOptions = { ...this.layoutOptions, ...options, pip: { ...(this.layoutOptions.pip || {}), ...(options.pip || {}) } };
    this._key = '';
    return this;
  }

  /** The <video> the camera plays in (null without one) — e.g. to show a separate monitor. */
  get video() { return this._cam && typeof this._cam.videoWidth === 'number' ? this._cam : null; }

  /** The camera's size once it plays, else null. */
  get cameraSize() { const [w, h] = dims(this._cam); return w ? { w, h } : null; }

  /**
   * Show a camera. A MediaStream plays in a hidden <video> made here; a <video>
   * (or a canvas) is drawn as is; null removes the camera (its tracks keep running:
   * stop them yourself). Resolves with the camera size once frames arrive (null on timeout).
   * @param {MediaStream|HTMLVideoElement|HTMLCanvasElement|null} src
   * @returns {Promise<{w:number,h:number}|null>}
   */
  async setCamera(src) {
    if (this._ownVideo) { try { this._ownVideo.pause(); } catch (e) { /* */ } this._ownVideo.srcObject = null; this._ownVideo = null; }
    this._cam = null;
    this._key = '';
    if (!src) return null;
    let el = src;
    if (typeof MediaStream !== 'undefined' && src instanceof MediaStream) {
      el = document.createElement('video');
      el.muted = true; el.playsInline = true; el.autoplay = true;
      el.srcObject = src;
      this._ownVideo = el;
    }
    this._cam = el;
    if (typeof el.videoWidth !== 'number') return this.cameraSize;
    if (el.paused) el.play().catch(() => { /* autoplay of a muted camera is allowed; a refusal shows as no frames */ });
    if (el.readyState >= 2 && el.videoWidth) return this.cameraSize;
    await new Promise((res) => {
      const done = () => { clearTimeout(t); el.removeEventListener('loadeddata', done); res(); };
      const t = setTimeout(done, 5000);
      el.addEventListener('loadeddata', done);
    });
    return this._cam === el ? this.cameraSize : null;
  }

  _rectsFor(work) {
    const [ww, wh] = dims(work), [cw, ch] = dims(this._cam);
    const key = `${this.layout}|${this.canvas.width}x${this.canvas.height}|${ww}x${wh}|${cw}x${ch}`;
    if (key !== this._key) {
      this.rects = layoutRects(this.layout, this.size, { workW: ww, workH: wh, camW: cw, camH: ch }, this.layoutOptions);
      this._key = key;
    }
    return this.rects;
  }

  /** Draw one frame now (hosts with their own loop call this right after the work renders). @returns the rects */
  draw() {
    const { ctx } = this, W = this.canvas.width, H = this.canvas.height;
    let work = null;
    try { work = this.getWorkCanvas ? this.getWorkCanvas() : null; } catch (e) { work = null; }
    const r = this._rectsFor(work);
    ctx.fillStyle = this.background;
    ctx.fillRect(0, 0, W, H);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    const [ww, wh] = dims(work);
    if (work && ww && wh) {
      const c = r.work.crop;
      try {
        if (c) ctx.drawImage(work, c.x, c.y, c.w, c.h, r.work.x, r.work.y, r.work.w, r.work.h);
        else ctx.drawImage(work, r.work.x, r.work.y, r.work.w, r.work.h);
      } catch (e) { /* a work canvas mid-resize can be 0×0 for a frame */ }
    }
    const cam = this._cam, cr = r.cam;
    if (cam && cr && cr.crop) {
      const [cw] = dims(cam), c = cr.crop;
      ctx.save();
      if (cr.radius > 0) { roundRectPath(ctx, cr.x, cr.y, cr.w, cr.h, cr.radius); ctx.clip(); }
      try {
        if (this.mirrorCam) {
          // the crop is in displayed (mirrored) coordinates: flip it back to source x
          ctx.translate(cr.x + cr.w, cr.y); ctx.scale(-1, 1);
          ctx.drawImage(cam, cw - c.x - c.w, c.y, c.w, c.h, 0, 0, cr.w, cr.h);
        } else ctx.drawImage(cam, c.x, c.y, c.w, c.h, cr.x, cr.y, cr.w, cr.h);
      } catch (e) { /* camera between frames */ }
      ctx.restore();
    }
    if (this.onDraw) {
      ctx.save();
      try { this.onDraw(ctx, r, this); } catch (e) { if (!this._warned) { this._warned = true; console.warn('[record] onDraw', e); } }
      ctx.restore();
    }
    this.frames++;
    return r;
  }

  /**
   * Draw over the camera in the camera's own coordinates: `fn(ctx, w, h)` gets a
   * context translated to where the WHOLE camera frame lands and clipped to the
   * visible camera rect — the shape HandTracker / PoseTracker `skeleton(ctx, w, h)`
   * expects. Call it from onDraw. No camera, no call.
   * @param {(ctx: CanvasRenderingContext2D, w: number, h: number) => void} fn
   */
  drawOnCamera(fn) {
    const cr = this.rects && this.rects.cam;
    if (!cr || !cr.frame) return;
    const { ctx } = this;
    ctx.save();
    if (cr.radius > 0) roundRectPath(ctx, cr.x, cr.y, cr.w, cr.h, cr.radius);
    else { ctx.beginPath(); ctx.rect(cr.x, cr.y, cr.w, cr.h); }
    ctx.clip();
    ctx.translate(cr.frame.x, cr.frame.y);
    try { fn(ctx, cr.frame.w, cr.frame.h); } finally { ctx.restore(); }
  }

  _tick(nowMs) {
    this._lastTick = nowMs;
    const gap = this.maxFps > 0 ? 1000 / this.maxFps - 1.5 : 0;   // 1.5 ms slack: 60 on a 60 Hz display never skips
    if (nowMs - this._lastDraw < gap) return;
    this._lastDraw = nowMs;
    this.draw();
    this._fpsN++;
    if (nowMs - this._fpsAt >= 1000) { this.fps = Math.round(this._fpsN * 1000 / (nowMs - this._fpsAt)); this._fpsN = 0; this._fpsAt = nowMs; }
  }

  /** Redraw every animation frame (and from a worker heartbeat while the tab is hidden). */
  start() {
    if (this.running) return this;
    this.running = true;
    this._fpsAt = performance.now(); this._fpsN = 0;
    const loop = (t) => { if (!this.running) return; this._raf = requestAnimationFrame(loop); this._tick(t); };
    this._raf = requestAnimationFrame(loop);
    // a hidden tab freezes requestAnimationFrame; a recording must not freeze with it
    // (same trick as @openav/core Loop: worker timers are not throttled)
    try {
      this._worker = new Worker(URL.createObjectURL(new Blob(['setInterval(() => postMessage(0), 33)'], { type: 'text/javascript' })));
      this._worker.onmessage = () => { const t = performance.now(); if (this.running && t - this._lastTick > 100) this._tick(t); };
    } catch (e) { /* strict CSP: no worker */ }
    return this;
  }

  stop() {
    this.running = false;
    if (this._raf) cancelAnimationFrame(this._raf);
    if (this._worker) { this._worker.terminate(); this._worker = null; }
    return this;
  }

  /** Stop drawing and let go of the camera (its tracks are the host's to stop). */
  dispose() { this.stop(); this.setCamera(null); }
}
