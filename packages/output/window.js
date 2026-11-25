// @openav/output · window — open an output window for a projector or a second screen.
//
//   button.onclick = () => openOutput(show, { name: 'front' });        // from a click: a browser opens a window only then
//
// Two ways to fill the window, and the show (and its world) never knows which:
//
//   mode 'mirror' (default)  The window shows the stage's canvas through canvas.captureStream() in a <video>. One render:
//                            the projector shows exactly what the operator's stage shows, everything included (a slider,
//                            a note, a random particle). It costs: the picture is the canvas's size on THIS page; it
//                            arrives about a frame later; it stops when this page reloads (open it again); it slows to
//                            the Loop's hidden-tab rate when this page is hidden (one screen, the output fullscreen over
//                            it); and it needs a <canvas> (a DOM or SVG world cannot be mirrored: use 'page').
//   mode 'page'              The window is this page again at its clean address (?output=…&follow=…), running the world
//                            itself as a @openav/sync follower: its own resolution and GPU, any machine. It shares the
//                            clock and every value a hand or a route holds, not signals or randomness: a world that reacts
//                            to a note, or integrates dt, draws something else there.

import { mountOutputView } from './view.js?v=7fe486df';
import { outputParams, outputKeys, paramReader } from './params.js?v=7fe486df';
import { normalizeCrop, FITS } from './crop.js?v=7fe486df';
import { loadRoom, saveRoom, defaultStorage, layoutDoc, parseOutputLayout, NAME_RE } from './layout.js?v=7fe486df';
import { outputUrl } from './url.js?v=7fe486df';
import { mountOutputPanel } from './panel.js?v=7fe486df';

const streams = new WeakMap();                     // canvas → its MediaStream (two windows of one canvas share it)
const isShow = (s) => !!(s && s.stage && s.params && s.timeline);

/** The canvas to mirror: the canvas itself, or the largest canvas inside an element (a show: its world's layer). */
export function findCanvas(source) {
  if (!source) return null;
  if (source.tagName === 'CANVAS') return source;
  const root = isShow(source) ? source.stage.layer : source;
  if (!root || typeof root.querySelectorAll !== 'function') return null;
  let best = null, area = 0;
  for (const c of root.querySelectorAll('canvas')) { const a = (c.width || 0) * (c.height || 0); if (a > area || !best) { best = c; area = a; } }
  return best;
}

function streamOf(canvas) {
  let s = streams.get(canvas);
  if (!s || s.getVideoTracks().every((t) => t.readyState === 'ended')) { s = canvas.captureStream(); streams.set(canvas, s); }
  return s;
}

/** Register an output's params on a Params (idempotent). */
function addParams(params, name) { if (params && !params.get(outputKeys(name).blackout)) params.add(outputParams(name)); }

/**
 * Open an output window and show the stage in it. Call it from a click (a browser opens a window only after a gesture).
 * @param {object|HTMLCanvasElement|HTMLElement} source  what createShow() returned, a canvas, or an element with a canvas in it
 * @param {object} [options]
 * @param {string} [options.name='main']   the output's name: its params (output/<name>/blackout, …/brightness), its saved corners
 * @param {object|null} [options.crop]      { x, y, w, h } of the stage, 0..1 (default: all of it)
 * @param {'contain'|'cover'|'stretch'} [options.fit='contain']
 * @param {'mirror'|'page'} [options.mode='mirror']
 * @param {object|null} [options.params]    a Params, when the source is not a show (for blackout and brightness)
 * @param {object|null} [options.timeline]  a Timeline, when the source is not a show
 * @param {string} [options.features]       window.open features (default a 960×540 popup)
 * @param {number|null} [options.aspect]    mode 'page': the stage's shape, passed in the address
 * @param {true|string|null} [options.via]  mode 'page': null = BroadcastChannel (this browser), true = this server's /relay, or a ws:// address
 * @param {string} [options.channel='oav-output']  mode 'page': the sync channel
 * @param {Storage|null} [options.storage]  where the corners are saved (default localStorage)
 * @returns {object} the output: { name, mode, window, closed, edit(), pattern(), room, set(), reset(), url, close() }
 */
export function openOutput(source, {
  name = 'main', crop = null, fit = 'contain', mode = 'mirror', params = null, timeline = null,
  features = 'popup,width=960,height=540', aspect = null, via = null, channel = 'oav-output', storage = defaultStorage(),
} = {}) {
  if (!NAME_RE.test(name)) throw new Error(`[output] openOutput: a name is 1–32 letters, digits, - or _, got ${JSON.stringify(name)}`);
  if (mode !== 'mirror' && mode !== 'page') throw new Error(`[output] openOutput: mode is 'mirror' or 'page', got ${JSON.stringify(mode)}`);
  if (!FITS.includes(fit)) throw new Error(`[output] openOutput: fit is ${FITS.join(', ')}, got ${JSON.stringify(fit)}`);
  const cropN = crop ? normalizeCrop(crop) : null;
  const show = isShow(source) ? source : null;
  const P = show ? show.params : params, T = show ? show.timeline : timeline;
  addParams(P, name);
  const keys = outputKeys(name), read = paramReader(P, T);
  const winName = 'oav-output-' + name;

  if (mode === 'page') {
    if (!show) throw new Error("[output] openOutput: mode 'page' needs a show (what createShow() returned)");
    const url = outputUrl(location.href, { name, crop: cropN, aspect, fit, follow: channel, via });
    const win = window.open(url, winName, features);
    if (!win) throw new Error('[output] the browser blocked the output window: call openOutput() from a click');
    // loaded on demand (and failing soft where follow.js is not beside this file, as in the lab's one-file bundle)
    const leading = import('./follow.js?v=7fe486df').then(({ leadOutputs }) => leadOutputs(show, { channel, via })).catch((e) => { console.warn('[output] this page cannot lead the output page:', e); return null; });
    const remote = () => { try { return win.openav?.output ?? null; } catch { return null; } };
    return {
      name, mode, window: win, url, leading,
      get closed() { return win.closed; },
      edit(on) { return remote()?.edit(on) ?? false; },
      pattern(on) { return remote()?.pattern(on) ?? false; },
      get room() { return remote()?.room ?? loadRoom(name, storage); },
      set(partial) { return remote()?.set(partial) ?? false; },
      reset(o) { return remote()?.reset(o) ?? false; },
      close() { try { win.close(); } catch { /* gone */ } },
    };
  }

  // ---------- mirror ----------
  let canvas = findCanvas(source);
  if (canvas && typeof canvas.captureStream !== 'function') throw new Error('[output] this browser cannot capture a canvas (captureStream): use mode \'page\'');
  const win = window.open('', winName, features);
  if (!win) throw new Error('[output] the browser blocked the output window: call openOutput() from a click');
  const doc = win.document;
  // a window of this name opened before (also by this page before a reload) comes back as it was: start its body again,
  // keep its <html> (and with it a fullscreen it is in)
  doc.title = `Output · ${name}`;
  doc.documentElement.style.background = '#000';
  const body = doc.createElement('body');
  body.style.cssText = 'margin:0;background:#000;overflow:hidden';
  if (doc.body) doc.body.replaceWith(body); else doc.documentElement.appendChild(body);
  const video = doc.createElement('video');
  video.muted = true; video.autoplay = true; video.playsInline = true; video.disablePictureInPicture = true;
  const attach = () => { if (canvas) { video.srcObject = streamOf(canvas); video.play?.().catch(() => {}); } };
  attach();
  const view = mountOutputView({
    doc, target: video, name, room: loadRoom(name, storage), crop: cropN, fit,
    sourceSize: () => (video.videoWidth > 0 ? { w: video.videoWidth, h: video.videoHeight } : canvas && canvas.width > 0 ? { w: canvas.width, h: canvas.height } : null),
    read: P ? (k) => read(keys[k]) : null,
    onRoom: (room) => saveRoom(name, room, storage),
    onBlackout: P ? (on) => P.override(keys.blackout, on ? 1 : 0) : null,
  });
  if (!canvas) view.say('There is no <canvas> on the stage to mirror (a DOM or SVG world?): open this output with mode \'page\'.', 0);
  // the world can replace its canvas (another world, a p5 restart): follow it; and notice when the window is closed
  const watch = setInterval(() => {
    if (win.closed) { clearInterval(watch); return; }
    const c = findCanvas(source);
    if (c && c !== canvas) { canvas = c; attach(); }
  }, 500);
  const bye = () => { try { if (!win.closed) view.say('The show page went away: this window keeps its last picture. Open the output again from the show page.', 0); } catch { /* gone */ } };
  window.addEventListener('pagehide', bye);
  return {
    name, mode, window: win, view,
    get closed() { return win.closed; },
    get canvas() { return canvas; },
    edit: (on) => view.edit(on),
    pattern: (on) => view.pattern(on),
    get room() { return view.room; },
    set: (partial) => view.set(partial),
    reset: (o) => view.reset(o),
    close() { clearInterval(watch); window.removeEventListener('pagehide', bye); try { win.close(); } catch { /* gone */ } },
  };
}

/** The stage of this page boxed to an aspect (centred, black around it), so a world draws the shape its projector has. */
function boxStage(show, aspect) {
  const c = show.stage.container, L = show.stage.layer;
  const fit = () => {
    const W = c.clientWidth, H = c.clientHeight;
    if (!(W > 0) || !(H > 0)) return;
    let w = W, h = W / aspect;
    if (h > H) { h = H; w = H * aspect; }
    L.style.cssText = `position:absolute;left:${((W - w) / 2).toFixed(1)}px;top:${((H - h) / 2).toFixed(1)}px;width:${w.toFixed(1)}px;height:${h.toFixed(1)}px;`;
  };
  new ResizeObserver(fit).observe(c);
  fit();
}

/**
 * Declare a show's outputs once, at load: their params exist from the start (so the timeline, a saved mapping and a
 * MIDI fader can reach them before any window is open), the stage takes the outputs' shape, and the desk gets an
 * "L4 · Output" panel to open, edit and test them, and to export and import the venue's layout.
 * @param {object} show   what createShow() returned
 * @param {object} [options]
 * @param {Array<{name:string, crop?:object, fit?:string}>} [options.outputs=[{ name: 'main' }]]
 * @param {number|null} [options.aspect=null]   the stage's shape on this page (16 / 9, 32 / 9 …); null leaves it as it is
 * @param {boolean|HTMLElement} [options.panel=true]   the desk panel (true: in the console), an element to put it in, or false
 * @param {true|string|null} [options.via=null] mode 'page' across browsers or machines: true = this server's /relay, or a ws:// address
 * @param {Storage|null} [options.storage]
 * @returns {object} { names, open(name, o), close(name), get(name), edit(name, on), pattern(name, on), lead(o), url(name, o), exportLayout(), importLayout(doc), keys(name) }
 */
export function createOutputs(show, { outputs = [{ name: 'main' }], aspect = null, panel = true, via = null, storage = defaultStorage() } = {}) {
  if (!isShow(show)) throw new Error('[output] createOutputs needs a show (what createShow() returned)');
  const decl = new Map();
  for (const o of outputs) {
    const d = typeof o === 'string' ? { name: o } : { ...o };
    if (!NAME_RE.test(d.name || '')) throw new Error(`[output] createOutputs: a name is 1–32 letters, digits, - or _, got ${JSON.stringify(d.name)}`);
    if (decl.has(d.name)) throw new Error(`[output] createOutputs: "${d.name}" is declared twice`);
    d.crop = d.crop ? normalizeCrop(d.crop) : null;
    d.fit = d.fit || 'contain';
    if (!FITS.includes(d.fit)) throw new Error(`[output] createOutputs: ${d.name}.fit is ${FITS.join(', ')}`);
    decl.set(d.name, d);
  }
  if (aspect !== null && !(Number.isFinite(aspect) && aspect > 0)) throw new Error(`[output] createOutputs: aspect is a number above 0 (16 / 9), got ${JSON.stringify(aspect)}`);
  show.params.add(outputParams([...decl.keys()]));
  if (aspect) boxStage(show, aspect);
  const open = new Map();
  const known = (name) => { if (!decl.has(name)) throw new Error(`[output] no output "${name}" (declared: ${[...decl.keys()].join(', ')})`); return decl.get(name); };
  const rig = {
    names: [...decl.keys()],
    aspect,
    /** Open (or bring back) an output window. From a click. o: { mode: 'mirror' | 'page', features }. */
    open(name, o = {}) {
      const d = known(name);
      const prev = open.get(name);
      if (prev && !prev.closed && (o.mode || 'mirror') === prev.mode) { try { prev.window.focus(); } catch { /* fine */ } return prev; }
      prev?.close();
      const out = openOutput(show, { name, crop: d.crop, fit: d.fit, aspect, via, storage, ...o });
      open.set(name, out);
      return out;
    },
    close(name) { open.get(name)?.close(); open.delete(name); },
    /** The open output of that name, or null. */
    get(name) { const o = open.get(name); return o && !o.closed ? o : null; },
    edit(name, on) { return rig.get(name)?.edit(on) ?? false; },
    pattern(name, on) { return rig.get(name)?.pattern(on) ?? false; },
    keys: (name) => outputKeys(known(name).name),
    /**
     * Lead the pages that follow this show (a clean address with &follow=oav-output: a second window, a kiosk browser, OBS,
     * TouchDesigner): every frame they get this page's clock and held values. o: { channel, via } (via: true = this server's
     * /relay, needed for another browser or machine). Resolves to the SyncLeader; calling it again changes nothing.
     */
    lead(o = {}) { return import('./follow.js?v=7fe486df').then(({ leadOutputs }) => leadOutputs(show, { via, ...o })); },
    /** The clean address of an output (for a kiosk browser, OBS or TouchDesigner). o: { follow, via, play }. */
    url(name, o = {}) { const d = known(name); return outputUrl(location.href, { name, crop: d.crop, fit: d.fit, aspect, ...o }); },
    /** Every declared output's room (what is open now, else what this browser saved) as an open-audiovisual/output@1 document. */
    exportLayout() {
      const rooms = {};
      for (const name of decl.keys()) rooms[name] = rig.get(name)?.room ?? loadRoom(name, storage);
      return layoutDoc(rooms, new Date().toISOString());
    },
    /** Take a layout file (object or JSON text): checked first (throws with every problem), then saved and applied to open windows. */
    importLayout(doc) {
      const d = parseOutputLayout(doc);
      for (const [name, room] of Object.entries(d.outputs)) {
        saveRoom(name, room, storage);
        const o = rig.get(name);
        if (o && o.mode === 'mirror') o.view.set(room, false);
      }
      return Object.keys(d.outputs);
    },
  };
  show.outputs = rig;
  // on the clean page of one of these outputs (?output=<name>), what the code declares for it applies where the address is silent
  const here = show.output && decl.get(show.output.name);
  if (here) show.output.declare({ crop: here.crop, fit: here.fit, aspect });
  if (panel && !show.output) rig.panel = mountOutputPanel(rig, panel === true ? null : panel);
  return rig;
}
