// @openav/align · align-ui — the align mode for the venue: handles over the picture and a panel. While it is on, every
// key belongs to it (caught in the capture phase, so the work's own keys wait) and the mouse drags handles. Browser only.
//
// Every change is saved 1 s later (createCalStore); Ctrl/⌘+S saves now, Ctrl/⌘+Z undoes.
//
//   A                back to play (the work decides how to enter: it calls setMode('align') and adds body.align)
//   Tab / 1–9        next zone (Shift+Tab back); a digit picks the zone of that name
//   C corners  G mesh  E feather (blend)  K masks      what to edit
//   [ ]              next handle (corners: top-left → top-right → bottom-right → bottom-left; mesh: control points;
//                    feather: left, right, top, bottom; masks: which one)
//   ← → ↑ ↓          move 1 px (Shift ×10, Alt ×0.25); feather: ↑ ↓ change its width; masks: Shift+arrows resize
//   mouse            click a handle to pick it, drag to move it; Shift+drag inside a zone moves the whole zone
//   + −              mesh density (2–9)
//   Q                turn the zone 90° clockwise (a projector hung the other way)
//   N / Delete       masks: add one / delete the one picked
//   , .              the zone's brightness −/+ 5 %
//   P / Shift+P      what is shown: the work → identify → cells → grid → edges → crosshair → bars → white → grey → black
//   V                next layout variant (the work's own list; each one keeps its own calibration)
//   O                frames and handles off/on (see the clean picture)      J  move the panel to another corner
//   Backspace        the picked handle back home; Shift+Backspace the whole zone
//   Ctrl/⌘+S  Ctrl/⌘+Z  L (backups: click one to restore)  X export  I import
//   D                next display (in an app with a bridge)
import { handlesOf, normalizeZone, defaultZone, resampleMesh, warpPoint, squareToQuad, quadOk, featherAt, rotateZone } from './warp.js?v=cedb93fa';
import { PATTERN_SOURCES, SOURCE_LABELS } from './pattern-texture.js?v=cedb93fa';

const MODES = ['corner', 'mesh', 'feather', 'mask'];
const SIDES = ['l', 'r', 't', 'b'];
const FONT = 'system-ui,-apple-system,"Segoe UI","PingFang TC","Noto Sans TC","Microsoft JhengHei",sans-serif';

/** Every word the panel shows, in English and Chinese. */
export const UI_WORDS = {
  en: {
    title: 'Align mode', zone: 'zone', mode: { corner: 'corners', mesh: 'mesh', feather: 'feather (blend)', mask: 'masks' },
    side: { l: 'left', r: 'right', t: 'top', b: 'bottom' }, corner: ['segment top-left', 'segment top-right', 'segment bottom-right', 'segment bottom-left'],
    handle: 'handle', point: (k, n, c, r) => `control point ${k} of ${n} (${c}×${r})`, shift: 'shift',
    edge: 'edge', featherNote: '(share of the zone; ↑ ↓ change it)', masks: 'masks', noMask: 'none (N adds one)',
    gain: 'brightness', gamma: 'feather gamma', shows: 'showing', variant: 'variant', pKey: 'P', vKey: 'V',
    save: 'save ⌘S', undo: 'undo ⌘Z', backups: 'backups L', exportB: 'export X', importB: 'import I', reset: 'reset zone', play: 'play A',
    dirty: '● unsaved changes (saved in 1 s)', never: '(not saved yet)', saved: (t, f, b) => `✓ saved ${t} (${f}${b ? ' + backup' : ''})`, failed: (w) => `⚠ save failed ${w}`,
    restore: 'restore', noBackups: 'no backups', folded: '⚠ the corners would fold or cross: not moved', noMaskYet: 'no mask: press N to add one',
    otherVariant: 'the last step was in another variant: press V to go back to it', nothingUndo: 'nothing to undo', oneVariant: 'only one variant',
    maxMasks: 'a zone has at most 8 masks', exported: (f) => `exported ${f}`, notExported: 'not exported', imported: 'imported', notImported: 'nothing imported',
    restored: (n) => `restored ${n}`, badBackup: 'this backup cannot be read', display: (r) => `output now on ${r}`, oneDisplay: 'one display only (or no app bridge)',
    keys: 'Tab / 1–9 zone   C corners   G mesh   E feather   K masks\n[ ] next handle   arrows 1 px (Shift ×10, Alt ×0.25)\ndrag a handle; Shift+drag inside a zone moves it\n+ − mesh density   Q turn 90°   N add mask   , . brightness\nBackspace handle home (Shift: the whole zone)\nO hide frames   J move panel   D next display   A play',
  },
  zh: {
    title: '對位模式', zone: '區', mode: { corner: '四角', mesh: '網格', feather: '羽化（融接）', mask: '遮罩' },
    side: { l: '左', r: '右', t: '上', b: '下' }, corner: ['段的左上', '段的右上', '段的右下', '段的左下'],
    handle: '把手', point: (k, n, c, r) => `控制點 ${k}／${n}（${c}×${r}）`, shift: '位移',
    edge: '邊', featherNote: '（區寬比例，↑↓ 調）', masks: '遮罩', noMask: '無（N 新增）',
    gain: '亮度', gamma: '羽化 gamma', shows: '畫面', variant: '擺法', pKey: 'P 換', vKey: 'V 換',
    save: '存檔 ⌘S', undo: '復原 ⌘Z', backups: '備份清單 L', exportB: '匯出 X', importB: '匯入 I', reset: '本區重設', play: '回播放 A',
    dirty: '● 有未存的改動（1 秒後自動存）', never: '（還沒存過）', saved: (t, f, b) => `✓ 已存 ${t}（${f}${b ? '＋備份' : ''}）`, failed: (w) => `⚠ 存檔失敗 ${w}`,
    restore: '回復', noBackups: '沒有備份', folded: '⚠ 四角會翻面或打結，沒動', noMaskYet: '沒有遮罩：按 N 新增',
    otherVariant: '上一步在另一種擺法，先按 V 切回去', nothingUndo: '沒有可以復原的', oneVariant: '只有一種擺法',
    maxMasks: '一區最多 8 塊遮罩', exported: (f) => `匯出 ${f}`, notExported: '沒有匯出', imported: '已匯入', notImported: '沒有匯入',
    restored: (n) => `已回復 ${n}`, badBackup: '讀不到這份備份', display: (r) => `輸出改到 ${r}`, oneDisplay: '只有一個螢幕（或不在 app 裡）',
    keys: 'Tab／1–9 換區　C 四角　G 網格　E 羽化　K 遮罩\n[ ] 換把手　方向鍵 1 px（Shift ×10，Alt ×0.25）\n滑鼠拖把手，Shift＋拖區內＝整區平移\n+ − 網格密度　Q 整區轉 90°　N 新增遮罩　, . 亮度\nBackspace 把手回原位（Shift 整區重設）\nO 隱藏外框　J 面板換角落　D 換螢幕　A 回播放',
  },
};

const css = `
#align-ui { position: fixed; left: 12px; top: 12px; z-index: 40; width: 360px; max-height: calc(100vh - 24px); overflow: auto;
  font: 13px/1.5 ${FONT}; color: #dfe6f0; background: rgba(8,10,14,.9); border: 1px solid #2c3442; border-radius: 8px; padding: 10px 12px; display: none; }
body.align #align-ui { display: block; }
body.align.align-clean #align-ui { opacity: .18; }
#align-ui.pos1 { left: auto; right: 12px; } #align-ui.pos2 { top: auto; bottom: 12px; left: auto; right: 12px; } #align-ui.pos3 { top: auto; bottom: 12px; }
#align-ui h3 { margin: 0 0 6px; font-size: 14px; color: #fff; }
#align-ui .row { display: flex; gap: 6px; flex-wrap: wrap; margin: 6px 0; }
#align-ui button { font: 12px ${FONT}; color: #dfe6f0; background: #1b2230; border: 1px solid #3a4558; border-radius: 5px; padding: 3px 8px; cursor: pointer; }
#align-ui button.on { background: #2f6fd6; border-color: #5b93ee; color: #fff; }
#align-ui .k { color: #8fa3bf; font-size: 12px; white-space: pre-wrap; }
#align-ui .st { color: #9fe0a6; } #align-ui .warn { color: #ffb46b; }
#align-overlay { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: contain; pointer-events: none; display: none; z-index: 5; }
body.align #align-overlay { display: block !important; }
body.align, body.align * { cursor: crosshair !important; }
`;

/**
 * Mount the align mode over a canvas that shows (part of) the desktop.
 * @param {object} o
 * @param {HTMLCanvasElement} o.canvas  the canvas the picture is drawn on (object-fit: contain in its parent)
 * @param {{x:number,y:number,w:number,h:number}} o.region  the part of the desktop that canvas shows
 * @param {() => object} o.getMapping  the current variant's mapping
 * @param {object} o.store  createCalStore()'s store
 * @param {object} o.state  { mode, source, variant, zone }, the mode's own state (saved with store.saveState)
 * @param {object} o.cal  a calibration through normalizeCalibration()
 * @param {(why:string) => void} o.onChange  the calibration ('cal') or the source ('source') changed: rebuild the warp
 * @param {(mode:'play'|'align') => void} o.setMode  leave (A, the play button) or enter the mode: the caller toggles body.align
 * @param {(variant:string) => void} [o.setVariant]  V picked another variant: the caller swaps mapping and calibration, then setState()
 * @param {(cal:object) => void} [o.replaceCalibration]  a backup or an imported file: the caller normalizes it, then setCalibration()
 * @param {string[]} [o.variants]  the variants V cycles through
 * @param {string[]} [o.sources]  what P cycles through (default PATTERN_SOURCES; a work can add its own)
 * @param {object} [o.sourceNames]  names for o.sources ({ en, zh } tables, or one flat table)
 * @param {'en'|'zh'} [o.lang]  the panel's language (default: zh when the page's lang starts with zh)
 * @returns {{ draw():void, setCalibration(cal:object):void, setState(s:object):void, save():Promise<void>, ui:object }}
 */
export function createAlignUI(o) {
  const { canvas, region, store } = o;
  const lang = o.lang ?? (/^zh/i.test(document.documentElement.lang || '') ? 'zh' : 'en');
  const T = UI_WORDS[lang] || UI_WORDS.en;
  const SOURCES = o.sources ?? PATTERN_SOURCES;
  const extra = o.sourceNames ?? o.sourceZh ?? {};   // sourceZh: the option's name in art-align
  const SOURCE_NAMES = { ...SOURCE_LABELS[lang], ...(extra[lang] ?? (extra.en || extra.zh ? {} : extra)) };
  let cal = o.cal, state = o.state;
  const style = document.createElement('style'); style.textContent = css; document.head.appendChild(style);
  const overlay = document.createElement('canvas'); overlay.id = 'align-overlay';
  overlay.width = region.w; overlay.height = region.h;
  canvas.parentElement.appendChild(overlay);
  const panel = document.createElement('div'); panel.id = 'align-ui'; document.body.appendChild(panel);

  const ui = { mode: 'corner', handle: 0, side: 0, mask: 0, clean: false, saveMsg: '', backups: null, dirty: false, history: [], dragging: null };
  const zonesOf = () => cal.variants[state.variant].zones;
  const M = () => o.getMapping();
  const tileNames = () => M().tiles.map((t) => t.name);
  const zone = () => zonesOf()[state.zone] ?? zonesOf()[tileNames()[0]];
  const tile = () => M().tiles.find((t) => t.name === state.zone) ?? M().tiles[0];
  if (!tileNames().includes(state.zone)) state.zone = tileNames()[0];

  // ---------- saving
  let saveTimer = 0;
  const snapshot = () => JSON.stringify(zone());
  function pushHistory() { ui.history.push({ variant: state.variant, zone: state.zone, z: snapshot() }); if (ui.history.length > 200) ui.history.shift(); }
  function changed(why = 'cal') {
    ui.dirty = true; o.onChange(why); draw();
    clearTimeout(saveTimer); saveTimer = setTimeout(save, 1000);
  }
  async function save() {
    clearTimeout(saveTimer);
    cal.savedAt = new Date().toISOString();
    try {
      const r = await store.saveCalibration(cal);
      ui.dirty = !r?.ok;
      ui.saveMsg = r?.ok ? T.saved(new Date().toLocaleTimeString(lang === 'zh' ? 'zh-TW' : 'en-GB', { hour12: false }), String(r.file).split(/[\\/]/).pop(), r.backup) : T.failed(r?.why ?? '');
    } catch (e) { ui.saveMsg = T.failed(e.message); }
    renderPanel();
  }
  const saveState = () => store.saveState({ ...state }).catch(() => {});

  // ---------- edits
  function nudge(dx, dy, shift) {
    const z = zone(); pushHistory();
    if (ui.mode === 'corner') { const c = z.corners[ui.handle % 4]; c[0] += dx; c[1] += dy; if (!quadOk(z.corners)) { c[0] -= dx; c[1] -= dy; flash(T.folded); return; } }
    else if (ui.mode === 'mesh') { const k = ui.handle % z.mesh.d.length; z.mesh.d[k][0] += dx; z.mesh.d[k][1] += dy; }
    else if (ui.mode === 'feather') { const s = SIDES[ui.side % 4]; z.feather[s] = Math.min(0.5, Math.max(0, +(z.feather[s] - dy * 0.005).toFixed(4))); }
    else if (ui.mode === 'mask') {
      const m = z.masks[ui.mask]; if (!m) { flash(T.noMaskYet); return; }
      const t = tile(), ku = 1 / t.dst.w, kv = 1 / t.dst.h;
      if (shift) { m.w = Math.max(0.005, Math.min(1, m.w + dx * ku)); m.h = Math.max(0.005, Math.min(1, m.h + dy * kv)); }
      else { m.u = Math.max(0, Math.min(1, m.u + dx * ku)); m.v = Math.max(0, Math.min(1, m.v + dy * kv)); }
    }
    changed();
  }
  function moveZone(dx, dy) { const z = zone(); for (const c of z.corners) { c[0] += dx; c[1] += dy; } }
  function resetHandle(all) {
    pushHistory();
    const z = zone(), d = defaultZone(tile());
    if (all) zonesOf()[state.zone] = d;
    else if (ui.mode === 'corner') z.corners[ui.handle % 4] = [...d.corners[ui.handle % 4]];
    else if (ui.mode === 'mesh') z.mesh.d[ui.handle % z.mesh.d.length] = [0, 0];
    else if (ui.mode === 'feather') z.feather[SIDES[ui.side % 4]] = 0;
    else if (ui.mode === 'mask') z.masks.splice(ui.mask, 1);
    changed();
  }
  function undo() {
    const h = ui.history.pop(); if (!h) { flash(T.nothingUndo); return; }
    if (h.variant !== state.variant) { flash(T.otherVariant); ui.history.push(h); return; }
    const t = M().tiles.find((x) => x.name === h.zone);
    zonesOf()[h.zone] = normalizeZone(JSON.parse(h.z), t); state.zone = h.zone; changed();
  }
  let flashMsg = '', flashT = 0;
  function flash(s) { flashMsg = s; flashT = performance.now(); renderPanel(); }

  // ---------- keys (in align mode every key is caught here)
  function onKey(e) {
    if (!document.body.classList.contains('align')) return;
    if (/^(input|select|textarea)$/i.test(e.target?.tagName || '')) return;
    e.stopImmediatePropagation(); e.preventDefault();
    const k = e.key, mod = e.metaKey || e.ctrlKey, step = e.shiftKey ? 10 : e.altKey ? 0.25 : 1;
    if (mod && (k === 's' || k === 'S')) return void save();
    if (mod && (k === 'z' || k === 'Z')) return void undo();
    if (mod) return;
    const names = tileNames();
    if (k === 'a' || k === 'A') return void o.setMode('play');
    if (k === 'Tab') { const i = names.indexOf(state.zone); state.zone = names[(i + (e.shiftKey ? names.length - 1 : 1)) % names.length]; ui.handle = 0; ui.mask = 0; saveState(); return void draw(); }
    if (/^[1-9]$/.test(k) && names.includes(k)) { state.zone = k; ui.handle = 0; ui.mask = 0; saveState(); return void draw(); }
    const modeKey = { c: 'corner', g: 'mesh', e: 'feather', k: 'mask' }[k.toLowerCase()];
    if (modeKey) { ui.mode = modeKey; ui.handle = 0; return void draw(); }
    if (k === '[' || k === ']') {
      const d = k === ']' ? 1 : -1, z = zone();
      if (ui.mode === 'corner') ui.handle = (ui.handle + d + 4) % 4;
      else if (ui.mode === 'mesh') ui.handle = (ui.handle + d + z.mesh.d.length) % z.mesh.d.length;
      else if (ui.mode === 'feather') ui.side = (ui.side + d + 4) % 4;
      else if (ui.mode === 'mask' && z.masks.length) ui.mask = (ui.mask + d + z.masks.length) % z.masks.length;
      return void draw();
    }
    const arrows = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[k];
    if (arrows) return void nudge(arrows[0] * step, arrows[1] * step, e.shiftKey && ui.mode === 'mask');
    if (k === '+' || k === '=' || k === '-' || k === '_') {
      if (ui.mode !== 'mesh') { ui.mode = 'mesh'; }
      const z = zone(), n = z.mesh.cols + (k === '-' || k === '_' ? -1 : 1);
      pushHistory(); z.mesh = resampleMesh(z.mesh, n, n); ui.handle = 0; return void changed();
    }
    if (k === 'q' || k === 'Q') { pushHistory(); rotateZone(zone(), e.shiftKey ? -1 : 1); return void changed(); }
    if (k === 'n' || k === 'N') { pushHistory(); const z = zone(); if (z.masks.length >= 8) return void flash(T.maxMasks); z.masks.push({ u: 0.4, v: 0.4, w: 0.2, h: 0.2 }); ui.mode = 'mask'; ui.mask = z.masks.length - 1; return void changed(); }
    if (k === 'Delete' || (k === 'Backspace' && ui.mode === 'mask' && !e.shiftKey)) { if (ui.mode === 'mask') return void resetHandle(false); }
    if (k === 'Backspace') return void resetHandle(e.shiftKey);
    if (k === ',' || k === '.') { pushHistory(); const z = zone(); z.gain = Math.max(0, Math.min(1.5, +(z.gain + (k === '.' ? 0.05 : -0.05)).toFixed(2))); return void changed(); }
    if (k === 'p' || k === 'P') { const i = SOURCES.indexOf(state.source); state.source = SOURCES[(i + (e.shiftKey ? SOURCES.length - 1 : 1)) % SOURCES.length]; saveState(); o.onChange('source'); return void draw(); }
    if (k === 'v' || k === 'V') { const vs = o.variants ?? [state.variant]; if (vs.length < 2) return void flash(T.oneVariant); return void o.setVariant?.(vs[(vs.indexOf(state.variant) + (e.shiftKey ? vs.length - 1 : 1)) % vs.length]); }
    if (k === 'j' || k === 'J') { ui.pos = ((ui.pos ?? 0) + 1) % 4; panel.className = ui.pos ? `pos${ui.pos}` : ''; return; }
    if (k === 'o' || k === 'O') { ui.clean = !ui.clean; document.body.classList.toggle('align-clean', ui.clean); return void draw(); }
    if (k === 'l' || k === 'L') return void showBackups();
    if (k === 'x' || k === 'X') return void store.exportTo(cal).then((r) => flash(r?.ok ? T.exported(r.file) : T.notExported));
    if (k === 'i' || k === 'I') return void importCal();
    if (k === 'd' || k === 'D') return void store.nextDisplay().then((r) => flash(r ? T.display(r) : T.oneDisplay));
  }
  addEventListener('keydown', onKey, true);

  async function showBackups() { ui.backups = await store.listBackups(); renderPanel(); }
  async function restore(name) {
    const c = await store.readBackup(name); if (!c) return flash(T.badBackup);
    o.replaceCalibration?.(c); flash(T.restored(name)); ui.backups = null;
  }
  async function importCal() { const c = await store.importFrom(); if (!c) return flash(T.notImported); o.replaceCalibration?.(c); flash(T.imported); }

  // ---------- mouse
  /** screen point → desktop px (the canvas is object-fit: contain) */
  function toDesktop(ev) {
    const r = canvas.getBoundingClientRect();
    const k = Math.min(r.width / region.w, r.height / region.h);
    const ox = r.left + (r.width - region.w * k) / 2, oy = r.top + (r.height - region.h * k) / 2;
    return { x: region.x + (ev.clientX - ox) / k, y: region.y + (ev.clientY - oy) / k, k };
  }
  function pick(p) {
    const tol = 18 / p.k;   // 18 screen px
    let best = null;
    for (const t of M().tiles) {
      const z = zonesOf()[t.name];
      for (const h of handlesOf(z)) {
        if (ui.mode === 'corner' && h.kind !== 'corner') continue;
        if (ui.mode === 'mesh' && h.kind !== 'mesh') continue;
        const d = Math.hypot(h.x - p.x, h.y - p.y);
        if (d < tol && (!best || d < best.d)) best = { d, zone: t.name, h };
      }
    }
    return best;
  }
  function inside(p) {   // the zone whose quad holds the point, the one drawn last first
    for (const t of [...M().tiles].reverse()) { const q = zonesOf()[t.name].corners; let s = 0, n = 0; for (let i = 0; i < 4; i++) { const [ax, ay] = q[i], [bx, by] = q[(i + 1) % 4]; const z = (bx - ax) * (p.y - ay) - (by - ay) * (p.x - ax); if (z > 0) s++; n++; } if (s === n) return t.name; }
    return null;
  }
  canvas.parentElement.addEventListener('pointerdown', (ev) => {
    if (!document.body.classList.contains('align') || ev.target.closest?.('#align-ui')) return;
    const p = toDesktop(ev);
    const hit = (ui.mode === 'corner' || ui.mode === 'mesh') && !ev.shiftKey ? pick(p) : null;
    if (hit) { state.zone = hit.zone; ui.handle = hit.h.i; pushHistory(); ui.dragging = { kind: 'handle', last: p }; }
    else { const z = inside(p); if (z) { state.zone = z; if (ev.shiftKey) { pushHistory(); ui.dragging = { kind: 'zone', last: p }; } } }
    saveState(); draw();
    ev.preventDefault(); ev.stopPropagation();
  }, true);
  addEventListener('pointermove', (ev) => {
    if (!ui.dragging) return;
    const p = toDesktop(ev), dx = p.x - ui.dragging.last.x, dy = p.y - ui.dragging.last.y;
    ui.dragging.last = p;
    const z = zone();
    if (ui.dragging.kind === 'zone') moveZone(dx, dy);
    else if (ui.mode === 'corner') { const c = z.corners[ui.handle % 4]; c[0] += dx; c[1] += dy; if (!quadOk(z.corners)) { c[0] -= dx; c[1] -= dy; } }
    else if (ui.mode === 'mesh') { const m = z.mesh.d[ui.handle % z.mesh.d.length]; m[0] += dx; m[1] += dy; }
    ui.dirty = true; o.onChange('cal'); draw();
  });
  addEventListener('pointerup', () => { if (ui.dragging) { ui.dragging = null; changed(); } });

  // ---------- the frames and handles over the picture (desktop px, on the overlay canvas)
  function draw() {
    renderPanel();
    const g = overlay.getContext('2d');
    g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, overlay.width, overlay.height);
    if (ui.clean) return;
    g.translate(-region.x, -region.y);
    const lw = Math.max(2, region.w / 1600);
    for (const t of M().tiles) {
      const z = zonesOf()[t.name], sel = t.name === state.zone, H = squareToQuad(z.corners);
      if (!H) continue;
      // the outline, sampled along each edge (a bent mesh bends it)
      g.beginPath();
      const N = 24, edge = [];
      for (let i = 0; i <= N; i++) edge.push([i / N, 0]);
      for (let i = 1; i <= N; i++) edge.push([1, i / N]);
      for (let i = 1; i <= N; i++) edge.push([1 - i / N, 1]);
      for (let i = 1; i < N; i++) edge.push([0, 1 - i / N]);
      edge.forEach(([u, v], i) => { const [x, y] = warpPoint(z, u, v, H); i ? g.lineTo(x, y) : g.moveTo(x, y); });
      g.closePath();
      g.strokeStyle = sel ? '#ffd23f' : 'rgba(120,180,255,.7)'; g.lineWidth = sel ? lw * 2 : lw; g.stroke();
      // the zone's name near its top-left (the middle is the pattern's)
      const [cx, cy] = warpPoint(z, 0.07, 0.14, H);
      g.font = `800 ${Math.round(lw * 34)}px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.lineWidth = lw * 5; g.strokeStyle = '#000'; g.fillStyle = sel ? '#ffd23f' : '#cfe0ff';
      const label = t.plan != null ? `${t.plan}` : `${t.name}`;
      g.strokeText(label, cx, cy); g.fillText(label, cx, cy);
      if (!sel) continue;
      if (ui.mode === 'mesh') {
        g.strokeStyle = 'rgba(255,210,63,.55)'; g.lineWidth = lw;
        const { cols, rows } = z.mesh;
        for (let j = 0; j < rows; j++) { g.beginPath(); for (let i = 0; i <= 24; i++) { const [x, y] = warpPoint(z, i / 24, j / (rows - 1), H); i ? g.lineTo(x, y) : g.moveTo(x, y); } g.stroke(); }
        for (let i = 0; i < cols; i++) { g.beginPath(); for (let j = 0; j <= 24; j++) { const [x, y] = warpPoint(z, i / (cols - 1), j / 24, H); j ? g.lineTo(x, y) : g.moveTo(x, y); } g.stroke(); }
      }
      if (ui.mode === 'feather') {
        const f = z.feather;
        g.fillStyle = 'rgba(255,120,60,.25)';
        const band = (u0, v0, u1, v1) => { g.beginPath(); [[u0, v0], [u1, v0], [u1, v1], [u0, v1]].forEach(([u, v], i) => { const [x, y] = warpPoint(z, u, v, H); i ? g.lineTo(x, y) : g.moveTo(x, y); }); g.closePath(); g.fill(); };
        if (f.l) band(0, 0, f.l, 1); if (f.r) band(1 - f.r, 0, 1, 1); if (f.t) band(0, 0, 1, f.t); if (f.b) band(0, 1 - f.b, 1, 1);
      }
      z.masks.forEach((m, i) => {
        g.beginPath(); [[m.u, m.v], [m.u + m.w, m.v], [m.u + m.w, m.v + m.h], [m.u, m.v + m.h]].forEach(([u, v], j) => { const [x, y] = warpPoint(z, u, v, H); j ? g.lineTo(x, y) : g.moveTo(x, y); }); g.closePath();
        g.setLineDash([lw * 6, lw * 4]); g.strokeStyle = ui.mode === 'mask' && i === ui.mask ? '#ff5d5d' : 'rgba(255,93,93,.6)'; g.lineWidth = lw * 1.5; g.stroke(); g.setLineDash([]);
      });
      for (const h of handlesOf(z)) {
        if (h.kind === 'corner' && ui.mode !== 'corner') continue;
        if (h.kind === 'mesh' && ui.mode !== 'mesh') continue;
        const on = h.i === ui.handle;
        g.beginPath(); g.arc(h.x, h.y, (on ? 14 : 9) * lw / 2, 0, Math.PI * 2);
        g.fillStyle = on ? '#ffd23f' : 'rgba(255,210,63,.35)'; g.fill();
        g.strokeStyle = '#000'; g.lineWidth = lw; g.stroke();
        if (on) { g.beginPath(); g.moveTo(h.x - 40 * lw / 2, h.y); g.lineTo(h.x + 40 * lw / 2, h.y); g.moveTo(h.x, h.y - 40 * lw / 2); g.lineTo(h.x, h.y + 40 * lw / 2); g.strokeStyle = '#ffd23f'; g.stroke(); }
      }
    }
  }

  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  function renderPanel() {
    const z = zone(), t = tile(), face = [t.plan != null ? `#${t.plan}` : '', t.label ?? ''].filter(Boolean).join(' ');
    const fx = (v) => v.toFixed(2);
    const what = ui.mode === 'corner' ? `${T.handle}: ${T.corner[ui.handle % 4]} (${z.corners[ui.handle % 4].map(fx).join(', ')})`
      : ui.mode === 'mesh' ? `${T.handle}: ${T.point(ui.handle % z.mesh.d.length + 1, z.mesh.d.length, z.mesh.cols, z.mesh.rows)}, ${T.shift} ${z.mesh.d[ui.handle % z.mesh.d.length].map(fx).join(', ')}`
      : ui.mode === 'feather' ? `${T.edge}: ${T.side[SIDES[ui.side % 4]]}   ${SIDES.map((s) => `${T.side[s]} ${z.feather[s]}`).join('  ')} ${T.featherNote}`
      : `${T.masks}: ${z.masks.length ? `${ui.mask + 1} / ${z.masks.length}` : T.noMask}`;
    const showFlash = flashMsg && performance.now() - flashT < 5000;
    panel.innerHTML = `
      <h3>${T.title}   <span style="color:#ffd23f">${T.zone} ${esc(state.zone)}</span>   ${esc(face)}   ${esc(t.output)} ${t.dst.w}×${t.dst.h}</h3>
      <div class="row">${MODES.map((m) => `<button data-mode="${m}" class="${m === ui.mode ? 'on' : ''}">${T.mode[m]}</button>`).join('')}</div>
      <div>${what}</div>
      <div>${T.gain} ${Math.round(z.gain * 100)}%   ${T.gamma} ${z.gamma}</div>
      <div class="row">${tileNames().map((n) => `<button data-zone="${esc(n)}" class="${n === state.zone ? 'on' : ''}">${esc(n)}</button>`).join('')}</div>
      <div>${T.shows}: <b>${esc(SOURCE_NAMES[state.source] ?? state.source)}</b> (${T.pKey})   ${T.variant}: <b>${esc(state.variant)}</b> (${T.vKey})</div>
      <div class="row"><button data-act="save">${T.save}</button><button data-act="undo">${T.undo}</button><button data-act="backups">${T.backups}</button><button data-act="export">${T.exportB}</button><button data-act="import">${T.importB}</button><button data-act="reset">${T.reset}</button><button data-act="play">${T.play}</button></div>
      <div class="${ui.dirty ? 'warn' : 'st'}">${ui.dirty ? T.dirty : esc(ui.saveMsg) || T.never}</div>
      ${showFlash ? `<div class="warn">${esc(flashMsg)}</div>` : ''}
      ${ui.backups ? `<div class="row" style="flex-direction:column">${ui.backups.length ? ui.backups.slice(0, 12).map((b) => `<button data-restore="${esc(b.name)}">${T.restore} ${esc(String(b.savedAt || b.name).replace('T', ' ').slice(0, 19))}</button>`).join('') : T.noBackups}</div>` : ''}
      <div class="k">${T.keys}</div>`;
  }
  panel.addEventListener('click', (ev) => {
    const b = ev.target.closest('button'); if (!b) return;
    if (b.dataset.mode) { ui.mode = b.dataset.mode; ui.handle = 0; }
    if (b.dataset.zone) { state.zone = b.dataset.zone; ui.handle = 0; saveState(); }
    if (b.dataset.restore) return void restore(b.dataset.restore);
    const a = b.dataset.act;
    if (a === 'save') save(); if (a === 'undo') undo(); if (a === 'backups') showBackups();
    if (a === 'export') store.exportTo(cal).then((r) => flash(r?.ok ? T.exported(r.file) : T.notExported));
    if (a === 'import') importCal(); if (a === 'reset') resetHandle(true); if (a === 'play') o.setMode('play');
    draw();
  });

  return {
    draw,
    setCalibration(c) { cal = c; ui.history = []; draw(); },
    setState(s) { state = s; if (!tileNames().includes(state.zone)) state.zone = tileNames()[0]; draw(); },
    save,
    get ui() { return ui; },
    featherAt,   // for tests and debugging
  };
}
