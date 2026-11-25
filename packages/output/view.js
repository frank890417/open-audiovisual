// @openav/output · view — one output surface: an element shown full-window on black, cropped, corner-pinned, flipped,
// turned, bordered, veiled, with a test pattern and an edit mode. It wraps whatever it is given: the <video> of a mirror
// window, or a page's own stage at the clean address. Every listener lives on this surface's own document and window
// (a key or a click in the output window is that window's gesture, not the show page's).
//
// Keys (in the output window):
//   E  edit the corners        G  test pattern          F  fullscreen          B  blackout          I  the help card
//   while editing:  drag a corner, or 1–4 (Tab) to pick one and the arrows to move it 1 px (Shift: 10 px) ·
//                   H flip left–right · V flip top–bottom · O turn 90° (Shift+O back) · [ ] border · R corners back ·
//                   Shift+R everything back · E or Esc done

import { pinnedBox, checkQuad } from './pin.js?v=7fe486df';
import { cropBox } from './crop.js?v=7fe486df';
import { defaultRoom, checkRoom } from './layout.js?v=7fe486df';
import { veilOf } from './params.js?v=7fe486df';

const EDIT_HELP = 'drag a corner · 1–4 or Tab picks one, arrows move it (Shift ×10) · H / V flip · O turn · [ ] border · R corners back · Shift+R all back · E done';
const KEYS_HELP = 'E corners · G test pattern · F fullscreen · B blackout · I this card';
const HIDE_CURSOR_MS = 2000;

const css = (el, s) => { el.style.cssText = s; return el; };

/**
 * @param {object} o
 * @param {Document} o.doc          the document to build in (an output window's, or the page's own)
 * @param {HTMLElement} o.target    what is shown (a <video>, a stage element); it is moved into the surface
 * @param {string} [o.name]
 * @param {object} [o.room]         corners, flipX, flipY, rotate, overscan, soft (layout.js); default: fill the window
 * @param {object|null} [o.crop]    { x, y, w, h } of the source, 0..1
 * @param {string} [o.fit]          contain · cover · stretch
 * @param {(box:{w:number,h:number})=>({w:number,h:number}|null)} o.sourceSize   the source's size in px (null: not known yet)
 * @param {(key:'blackout'|'brightness')=>number|undefined} [o.read]   the output's params, read every frame
 * @param {(room:object)=>void} [o.onRoom]       the room changed (save it)
 * @param {(on:boolean)=>void} [o.onBlackout]    B was pressed (write the param)
 * @param {(on:boolean)=>void} [o.onEdit]        edit mode changed
 * @param {boolean} [o.card=true]                the help card on open (a window a person opened); a clean page in OBS or
 *                                                TouchDesigner opens without it (I shows it)
 */
export function mountOutputView({ doc, target, name = 'main', room = defaultRoom(), crop = null, fit = 'contain', sourceSize, read = null, onRoom = null, onBlackout = null, onEdit = null, card: cardOn = true }) {
  const win = doc.defaultView;
  const mk = (tag, s, parent) => { const e = doc.createElement(tag); if (s) css(e, s); if (parent) parent.appendChild(e); return e; };
  let rm = checkRoom(room, name)[0];
  let editing = false, patterned = false, sel = 0, last = { W: 0, H: 0, sw: 0, sh: 0, cw: 0, ch: 0 }, veil = -1, drag = null, cursorTimer = 0, disposed = false;

  const root = mk('div', 'position:fixed;inset:0;background:#000;overflow:hidden;z-index:2147483000;user-select:none;-webkit-user-select:none;touch-action:none');
  root.className = 'oav-output';
  root.dataset.output = name;
  const surface = mk('div', 'position:absolute;left:0;top:0;transform-origin:0 0;will-change:transform', root);
  const content = mk('div', 'position:absolute;overflow:hidden;background:#000', surface);
  const clip = mk('div', 'position:absolute;overflow:hidden', content);
  css(target, 'position:absolute;display:block;margin:0;max-width:none;max-height:none;object-fit:fill;background:#000');
  clip.appendChild(target);
  const veilEl = mk('div', 'position:absolute;inset:0;background:#000;opacity:0;pointer-events:none', surface);
  const pattern = mk('canvas', 'position:absolute;left:0;top:0;width:100%;height:100%;display:none;pointer-events:none', surface);
  const outline = doc.createElementNS('http://www.w3.org/2000/svg', 'svg');
  outline.setAttribute('style', 'position:absolute;inset:0;width:100%;height:100%;display:none;pointer-events:none;overflow:visible');
  const poly = doc.createElementNS('http://www.w3.org/2000/svg', 'polygon');
  poly.setAttribute('style', 'fill:none;stroke:#ffd166;stroke-width:1.5;stroke-dasharray:6 4');
  outline.appendChild(poly); root.appendChild(outline);
  const handles = [0, 1, 2, 3].map((i) => {
    const h = mk('div', 'position:absolute;width:30px;height:30px;margin:-15px 0 0 -15px;border-radius:50%;border:2px solid #ffd166;background:rgba(255,209,102,.18);display:none;cursor:grab;box-sizing:border-box;font:700 11px/26px system-ui,sans-serif;color:#ffd166;text-align:center', root);
    h.textContent = String(i + 1);
    h.dataset.corner = String(i);
    return h;
  });
  const hud = mk('div', 'position:absolute;left:12px;bottom:12px;right:12px;display:none;padding:8px 12px;border-radius:8px;background:rgba(10,12,17,.86);color:#ffd166;font:12px/1.5 ui-monospace,monospace;pointer-events:none', root);
  const card = mk('div', 'position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:min(520px,86vw);padding:18px 20px;border-radius:14px;background:rgba(10,12,17,.92);border:1px solid #283044;color:#cfd6e4;font:14px/1.5 system-ui,sans-serif;box-shadow:0 10px 40px rgba(0,0,0,.6)', root);
  const toast = mk('div', 'position:absolute;left:50%;top:16px;transform:translateX(-50%);max-width:86vw;padding:8px 14px;border-radius:10px;background:rgba(10,12,17,.9);color:#cfd6e4;font:13px system-ui,sans-serif;display:none;pointer-events:none', root);

  // ---------- geometry ----------
  function layout() {
    const W = root.clientWidth || win.innerWidth, H = root.clientHeight || win.innerHeight;
    if (!(W > 0) || !(H > 0)) return;
    let box;
    try { box = pinnedBox(rm, W, H); } catch (e) { rm = { ...rm, corners: defaultRoom().corners }; box = pinnedBox(rm, W, H); say('Those corners could not be used: back to the full window.'); }
    css(surface, `position:absolute;left:0;top:0;width:${box.width}px;height:${box.height}px;transform-origin:0 0;will-change:transform;transform:${box.css}`);
    const o = rm.overscan || 0;
    const cw = box.width * (1 - 2 * o), ch = box.height * (1 - 2 * o);
    content.style.left = `${box.width * o}px`; content.style.top = `${box.height * o}px`;
    content.style.width = `${cw}px`; content.style.height = `${ch}px`;
    const s = rm.soft || 0;
    const m = s > 0 ? `linear-gradient(to right, transparent, #000 ${s * 100}%, #000 ${100 - s * 100}%, transparent), linear-gradient(to bottom, transparent, #000 ${s * 100}%, #000 ${100 - s * 100}%, transparent)` : '';
    content.style.maskImage = content.style.webkitMaskImage = m;
    content.style.maskComposite = s > 0 ? 'intersect' : '';
    content.style.webkitMaskComposite = s > 0 ? 'source-in' : '';
    const src = cw > 0 && ch > 0 ? sourceSize({ w: cw, h: ch }) : null;
    if (src && src.w > 0 && src.h > 0) {
      const p = cropBox({ crop, source: src, box: { w: cw, h: ch }, fit });
      Object.assign(clip.style, { left: `${p.clip.left}px`, top: `${p.clip.top}px`, width: `${p.clip.width}px`, height: `${p.clip.height}px` });
      Object.assign(target.style, { left: `${p.source.left - p.clip.left}px`, top: `${p.source.top - p.clip.top}px`, width: `${p.source.width}px`, height: `${p.source.height}px` });
      last.sw = src.w; last.sh = src.h;
    }
    last.W = W; last.H = H; last.cw = cw; last.ch = ch;
    box.quad.forEach(([x, y], i) => { handles[i].style.left = `${x}px`; handles[i].style.top = `${y}px`; });
    poly.setAttribute('points', box.quad.map((p) => p.join(',')).join(' '));
    if (patterned) drawPattern(box.width, box.height);
    if (editing) hud.textContent = `${name} · ${W}×${H} · corner ${sel + 1} · ${rm.rotate}°${rm.flipX ? ' · flip ↔' : ''}${rm.flipY ? ' · flip ↕' : ''}${rm.overscan ? ` · border ${(rm.overscan * 100).toFixed(1)}%` : ''}\n${EDIT_HELP}`;
  }
  hud.style.whiteSpace = 'pre-wrap';

  function setRoom(next, save = true) {
    const [r, problems] = checkRoom(next, name);
    if (problems.length) return false;
    rm = r;
    layout();
    if (save) onRoom?.(structuredClone(rm));
    return true;
  }
  function moveCorner(i, x, y, save) {
    const corners = rm.corners.map((p) => p.slice());
    corners[i] = [x, y];
    if (checkQuad(corners) || corners[i].some((v) => v < -0.5 || v > 1.5)) return false;   // a fold or a collapse: the corner stays
    return setRoom({ ...rm, corners }, save);
  }

  // ---------- test pattern: a grid, a crosshair, circles, the edges in colour (which side is which after a flip) ----------
  function drawPattern(w, h) {
    const dpr = Math.min(2, win.devicePixelRatio || 1);
    const pw = Math.max(1, Math.round(w * dpr)), ph = Math.max(1, Math.round(h * dpr));
    if (pattern.width !== pw) pattern.width = pw;
    if (pattern.height !== ph) pattern.height = ph;
    const g = pattern.getContext('2d');
    if (!g) return;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.fillStyle = '#000'; g.fillRect(0, 0, w, h);
    const cell = Math.min(w, h) / 8;
    g.lineWidth = 1; g.strokeStyle = 'rgba(255,255,255,.45)';
    g.beginPath();
    for (let x = w / 2 % cell; x <= w; x += cell) { g.moveTo(Math.round(x) + 0.5, 0); g.lineTo(Math.round(x) + 0.5, h); }
    for (let y = h / 2 % cell; y <= h; y += cell) { g.moveTo(0, Math.round(y) + 0.5); g.lineTo(w, Math.round(y) + 0.5); }
    g.stroke();
    g.lineWidth = 2; g.strokeStyle = '#fff';
    g.beginPath(); g.moveTo(w / 2, 0); g.lineTo(w / 2, h); g.moveTo(0, h / 2); g.lineTo(w, h / 2); g.moveTo(0, 0); g.lineTo(w, h); g.moveTo(w, 0); g.lineTo(0, h); g.stroke();
    for (const r of [0.45, 0.3, 0.15]) { g.beginPath(); g.arc(w / 2, h / 2, Math.min(w, h) * r, 0, Math.PI * 2); g.stroke(); }
    const edge = Math.max(4, Math.min(w, h) / 90);
    g.fillStyle = '#ff4d4d'; g.fillRect(0, 0, w, edge);                 // top: red
    g.fillStyle = '#4dff88'; g.fillRect(w - edge, 0, edge, h);          // right: green
    g.fillStyle = '#4d8dff'; g.fillRect(0, h - edge, w, edge);          // bottom: blue
    g.fillStyle = '#ffd166'; g.fillRect(0, 0, edge, h);                 // left: yellow
    const fs = Math.max(12, Math.round(Math.min(w, h) / 22));
    g.font = `700 ${fs}px system-ui, sans-serif`; g.fillStyle = '#fff'; g.textBaseline = 'top';
    const pad = edge * 2.5;
    g.textAlign = 'left'; g.fillText('1 TL', pad, pad); g.textAlign = 'right'; g.fillText('TR 2', w - pad, pad);
    g.textBaseline = 'bottom'; g.fillText('BR 3', w - pad, h - pad); g.textAlign = 'left'; g.fillText('4 BL', pad, h - pad);
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillStyle = '#000'; g.fillRect(w / 2 - fs * 6, h / 2 + fs * 1.2, fs * 12, fs * 1.6);
    g.fillStyle = '#fff'; g.fillText(`${name} · ${Math.round(w)} × ${Math.round(h)}`, w / 2, h / 2 + fs * 2);
  }

  // ---------- the card: how to get this window onto the projector ----------
  let screens = null;
  function renderCard() {
    card.innerHTML = '';
    const h = mk('div', 'font:700 15px system-ui,sans-serif;color:#fff;margin-bottom:6px', card);
    h.textContent = `Output · ${name}`;
    const p = mk('div', 'margin-bottom:10px', card);
    const row = mk('div', 'display:flex;flex-wrap:wrap;gap:8px;margin:8px 0', card);
    const button = (label, fn, primary) => {
      const b = mk('button', `padding:7px 12px;border-radius:9px;border:1px solid ${primary ? '#8a6d1f' : '#283044'};background:${primary ? '#2a2210' : '#141a26'};color:${primary ? '#ffd166' : '#cfd6e4'};font:600 13px system-ui,sans-serif;cursor:pointer`, row);
      b.type = 'button'; b.textContent = label;
      b.addEventListener('click', (e) => { e.stopPropagation(); fn(); });
      return b;
    };
    const multi = typeof win.getScreenDetails === 'function' && win.screen?.isExtended === true;
    if (screens && screens.length) {
      p.textContent = 'Click the screen this output goes to:';
      for (const s of screens) button(`${s.label || 'screen'} · ${s.width}×${s.height}${s.isPrimary ? ' · primary' : ''}`, () => fullscreen(s), !s.isPrimary);
    } else {
      p.textContent = multi
        ? 'Drag this window onto the projector and press F, or let this page find the screens (the browser asks once whether it may place windows).'
        : 'Drag this window onto the projector (or another screen), then press F. On one screen it is just a window: press F to try it full.';
      button('Fullscreen', () => fullscreen(null), true);
      if (multi) button('Find the screens…', findScreens);
    }
    button('Close this card', () => showCard(false));
    const k = mk('div', 'color:#8691a8;font:12px ui-monospace,monospace;margin-top:6px', card);
    k.textContent = KEYS_HELP;
  }
  async function findScreens() {                // only ever from a click in this window: the permission prompt needs a gesture
    try { const d = await win.getScreenDetails(); screens = d.screens; renderCard(); }
    catch (e) { say('This browser may not place windows here: drag the window onto the projector and press F.'); }
  }
  async function fullscreen(screen) {
    try {
      const opts = { navigationUI: 'hide', ...(screen ? { screen } : {}) };
      await doc.documentElement.requestFullscreen(opts);
    } catch (e) { say(`Fullscreen was refused (${e.name || 'error'}): click Fullscreen or press F in this window.`); }
  }
  function showCard(on) { card.style.display = on ? '' : 'none'; if (on) renderCard(); }
  // with the permission already given there is no prompt: list the screens at once
  (async () => {
    try {
      if (typeof win.getScreenDetails !== 'function' || win.screen?.isExtended !== true) return;
      const st = await win.navigator.permissions?.query({ name: 'window-management' });
      if (st?.state === 'granted') { screens = (await win.getScreenDetails()).screens; if (card.style.display !== 'none') renderCard(); }
    } catch { /* no Permissions API for it: the card offers the button */ }
  })();

  // ---------- messages ----------
  let toastTimer = 0;
  function say(msg, ms = 4000) {
    toast.textContent = msg; toast.style.display = '';
    win.clearTimeout(toastTimer);
    if (ms) toastTimer = win.setTimeout(() => { toast.style.display = 'none'; }, ms);
  }

  // ---------- modes ----------
  function edit(on = !editing) {
    editing = !!on;
    for (const h of handles) h.style.display = editing ? '' : 'none';
    outline.style.display = editing ? '' : 'none';
    hud.style.display = editing ? '' : 'none';
    root.style.cursor = editing ? 'crosshair' : '';
    if (editing) showCard(false);
    selectCorner(sel);
    layout();
    onEdit?.(editing);
    return editing;
  }
  function showPattern(on = !patterned) {
    patterned = !!on;
    pattern.style.display = patterned ? '' : 'none';
    layout();
    return patterned;
  }
  function selectCorner(i) {
    sel = ((i % 4) + 4) % 4;
    handles.forEach((h, j) => { h.style.background = j === sel ? 'rgba(255,209,102,.55)' : 'rgba(255,209,102,.18)'; h.style.color = j === sel ? '#000' : '#ffd166'; });
  }

  // ---------- input: keys, a corner dragged, the cursor hidden when still ----------
  const keyTarget = doc.body;
  function onKey(e) {
    if (disposed || !root.isConnected) return;
    const tag = e.target?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || e.metaKey || e.ctrlKey || e.altKey) return;
    const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    let done = true;
    const W = last.W || 1, H = last.H || 1, step = e.shiftKey ? 10 : 1;
    if (k === 'e') edit();
    else if (k === 'g') showPattern();
    else if (k === 'f') { if (doc.fullscreenElement) doc.exitFullscreen?.(); else fullscreen(null); }
    else if (k === 'b') onBlackout?.(!(read?.('blackout') >= 0.5));
    else if (k === 'i' || k === '?') showCard(card.style.display === 'none');
    else if (k === 'Escape') { if (editing) edit(false); else if (card.style.display !== 'none') showCard(false); else done = false; }
    else if (!editing) done = false;
    else if (/^[1-4]$/.test(k)) { selectCorner(Number(k) - 1); layout(); }
    else if (k === 'Tab') { selectCorner(sel + (e.shiftKey ? -1 : 1)); layout(); }
    else if (k === 'ArrowLeft' || k === 'ArrowRight' || k === 'ArrowUp' || k === 'ArrowDown') {
      const [x, y] = rm.corners[sel];
      const dx = k === 'ArrowLeft' ? -step : k === 'ArrowRight' ? step : 0, dy = k === 'ArrowUp' ? -step : k === 'ArrowDown' ? step : 0;
      moveCorner(sel, x + dx / W, y + dy / H, true);
    }
    else if (k === 'h') setRoom({ ...rm, flipX: !rm.flipX });
    else if (k === 'v') setRoom({ ...rm, flipY: !rm.flipY });
    else if (k === 'o') setRoom({ ...rm, rotate: (rm.rotate + (e.shiftKey ? 270 : 90)) % 360 });
    else if (k === '[' || k === ']') setRoom({ ...rm, overscan: Math.min(0.45, Math.max(0, +(rm.overscan + (k === ']' ? 0.005 : -0.005)).toFixed(4))) });
    else if (k === 'r') setRoom(e.shiftKey ? defaultRoom() : { ...rm, corners: defaultRoom().corners });
    else done = false;
    if (done) { e.preventDefault(); e.stopImmediatePropagation(); }   // the show's own keys (Space, arrows, R) do not see it
  }
  keyTarget.addEventListener('keydown', onKey, true);

  function pointerPos(e) { const r = root.getBoundingClientRect(); return [(e.clientX - r.left) / (r.width || 1), (e.clientY - r.top) / (r.height || 1)]; }
  root.addEventListener('pointerdown', (e) => {
    const i = e.target?.dataset?.corner;
    if (!editing || i === undefined) return;
    selectCorner(Number(i));
    const [px, py] = pointerPos(e), [cx, cy] = rm.corners[sel];
    drag = { id: e.pointerId, dx: cx - px, dy: cy - py };
    try { e.target.setPointerCapture(e.pointerId); } catch { /* not capturable */ }
    handles[sel].style.cursor = 'grabbing';
    e.preventDefault();
  });
  root.addEventListener('pointermove', (e) => {
    showCursor();
    if (!drag || e.pointerId !== drag.id) return;
    const [px, py] = pointerPos(e);
    moveCorner(sel, px + drag.dx, py + drag.dy, false);
  });
  const endDrag = (e) => { if (!drag || e.pointerId !== drag.id) return; drag = null; handles[sel].style.cursor = 'grab'; onRoom?.(structuredClone(rm)); };
  root.addEventListener('pointerup', endDrag);
  root.addEventListener('pointercancel', endDrag);
  function showCursor() {
    if (!editing) root.style.cursor = '';
    win.clearTimeout(cursorTimer);
    cursorTimer = win.setTimeout(() => { if (!editing && !disposed) root.style.cursor = 'none'; }, HIDE_CURSOR_MS);
  }
  const onFs = () => { if (disposed || !root.isConnected) return; if (doc.fullscreenElement) showCard(false); layout(); };
  doc.addEventListener('fullscreenchange', onFs);

  // ---------- every frame of THIS window: the veil, and a new size of the window or the source ----------
  function tick() {
    if (disposed || !root.isConnected) return;
    const v = read ? veilOf(read('blackout') ?? 0, read('brightness') ?? 1) : 0;
    if (v !== veil) { veil = v; veilEl.style.opacity = String(v); }
    const W = root.clientWidth, H = root.clientHeight;
    const s = last.cw > 0 && last.ch > 0 ? sourceSize({ w: last.cw, h: last.ch }) : null;   // the same box layout() measured with
    if (W !== last.W || H !== last.H || (s && (s.w !== last.sw || s.h !== last.sh))) layout();
    win.requestAnimationFrame(tick);
  }

  doc.body.appendChild(root);
  showCard(cardOn);
  layout();
  showCursor();
  win.requestAnimationFrame(tick);

  return {
    root, surface, target,
    get name() { return name; },
    /** Edit the corners: true, false, or nothing to switch. Returns whether it is on. */
    edit,
    /** The test pattern: true, false, or nothing to switch. */
    pattern: showPattern,
    get editing() { return editing; },
    get patterned() { return patterned; },
    /** This output's room now (a copy). */
    get room() { return structuredClone(rm); },
    /** Change part of the room ({ corners, flipX, flipY, rotate, overscan, soft }); false (and nothing changed) when it is not valid. */
    set(partial, save = true) { return setRoom({ ...rm, ...partial }, save); },
    /** The corners back to the full window (everything back with { all: true }). */
    reset({ all = false } = {}) { return setRoom(all ? defaultRoom() : { ...rm, corners: defaultRoom().corners }); },
    /** Show another part of the source, or fit it another way, or measure it another way: { crop, fit, sourceSize }. */
    configure(o = {}) {
      if ('crop' in o) crop = o.crop;
      if (o.fit) fit = o.fit;
      if (typeof o.sourceSize === 'function') sourceSize = o.sourceSize;
      layout();
    },
    say, layout, fullscreen, card: showCard,
    dispose() { disposed = true; keyTarget.removeEventListener('keydown', onKey, true); doc.removeEventListener('fullscreenchange', onFs); root.remove(); },
  };
}
