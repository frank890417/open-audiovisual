// @openav/dmx · monitor — what the lights are getting, on the page, with no light and no interface: one swatch per patched
// fixture (its mixed colour times its dimmer, a moving head's pan and tilt as a small direction mark) and the 512 channels
// of a universe as a grid (each cell its value as a bar, the number when it is not 0, tinted by the fixture it belongs to).
//
//   const mon = mountDmxMonitor(el, { patch, transport });   // transport: optional, its status shows (a serial one gets a Connect button)
//   out.send(engine.render(t)); mon.update();                // every frame: what the transport delivered, after its flash guard
//   mon.update(engine.render(t));                            // or any universes you hand it (a Universes, or { id: bytes })
//
// With a transport it also shows its flash guard: which fixtures it is holding back right now (an amber ring), and, for as
// long as the transport was made with { flashGuard: false }, a red FLASH GUARD OFF that does not go away. With the engine
// ({ engine }) the fixtures the engine's per-fixture cap slows get a small "slow" mark.
//
// Everything is read back from the BYTES, the way a fixture would read them: a profile that is one channel off shows the
// wrong colour here too. No dependencies; the dark console theme. fixtureLook() is the pure part (tests run it in Node).

const SLOTS = 512, COLS = 32, ROWS = SLOTS / COLS;
const clamp01 = (v) => (v > 1 ? 1 : v > 0 ? v : 0);
// what each emitter adds to the mix, as RGB (amber, UV and the whites are read as the colour a person sees, roughly)
const EMITTER = {
  red: [1, 0, 0], green: [0, 1, 0], blue: [0, 0, 1], white: [1, 1, 1], warmWhite: [1, 0.82, 0.6], coldWhite: [0.85, 0.92, 1],
  amber: [1, 0.6, 0], uv: [0.35, 0, 0.8], lime: [0.6, 1, 0], indigo: [0.3, 0, 0.55],
};
const CMY = new Set(['cyan', 'magenta', 'yellow']);
const CMY_TINT = { cyan: [0, 1, 1], magenta: [1, 0, 1], yellow: [1, 1, 0] };
const LAMP = [1, 0.9, 0.75];            // a fixture with no colour channel: a warm white lamp

/**
 * What one placed fixture shows for a universe's bytes: { color, mixed, dimmer, pan, tilt, strobe }.
 * `mixed` is the colour of its emitters ([r, g, b] 0..1, the brightest at 1 when they add up past it), `dimmer` its intensity
 * channel (1 when it has none: then the dimmer is already in the colour bytes), `color` = mixed × dimmer, the swatch.
 * `pan` and `tilt` are 0..1 (16-bit when the mode has the fine byte) or null; `strobe` the strobe byte or null.
 * @param {object} rec  a placed fixture (Patch.get(id))
 * @param {ArrayLike<number>} data  the 512 bytes of its universe
 */
export function fixtureLook(rec, data) {
  const L = rec.layout, at = rec.address - 1;
  const byte = (s) => (data[at + s.offset] | 0);
  const wide = (s) => (s.fineOffset >= 0 ? (byte(s) * 256 + (data[at + s.fineOffset] | 0)) / 65535 : byte(s) / 255);
  const dimmer = L.intensity ? byte(L.intensity) / 255 : 1;
  let mixed;
  if (!L.colors.length) mixed = [...LAMP];
  else if (L.colors.every((s) => CMY.has(s.color))) {
    // colour flags in front of a white lamp: each takes its complement out
    const v = (c) => { const s = L.colors.find((x) => x.color === c); return s ? byte(s) / 255 : 0; };
    mixed = [1 - v('cyan'), 1 - v('magenta'), 1 - v('yellow')];
  } else {
    mixed = [0, 0, 0];
    for (const s of L.colors) { const e = EMITTER[s.color]; if (!e) continue; const v = byte(s) / 255; for (let i = 0; i < 3; i++) mixed[i] += e[i] * v; }
    const top = Math.max(...mixed);
    if (top > 1) mixed = mixed.map((x) => x / top);
  }
  return {
    color: mixed.map((x) => clamp01(x * dimmer)), mixed, dimmer,
    pan: L.pan ? wide(L.pan) : null, tilt: L.tilt ? wide(L.tilt) : null, strobe: L.strobe ? byte(L.strobe) : null,
  };
}

/** [r, g, b] 0..1 → "rgb(…)" */
export const cssColor = (c) => `rgb(${c.map((x) => Math.round(clamp01(x) * 255)).join(' ')})`;

/** The universes to show: a Universes, a Map, or { id: bytes } → [[id, bytes]] */
function listOf(universes) {
  if (!universes) return [];
  if (typeof universes.ids === 'function' && typeof universes.bytes === 'function') return universes.ids().map((id) => [id, universes.bytes(id)]);
  const entries = universes instanceof Map ? [...universes] : Object.entries(universes);
  return entries.map(([id, b]) => [Number(id), b && b.data ? b.data : b]);
}

const CSS = `
.oav-dmx { box-sizing: border-box; display: flex; flex-direction: column; gap: 6px; padding: 8px 10px 10px; background: rgba(11, 14, 21, .94);
  border-top: 1px solid #1c2334; color: #cfd6e4; font: 11px/1.4 ui-monospace, SFMono-Regular, Menlo, monospace; }
.oav-dmx * { box-sizing: border-box; }
.oav-dmx-head { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; min-height: 22px; }
.oav-dmx-head b { color: #fff; font-weight: 700; letter-spacing: .04em; }
.oav-dmx-tabs { display: flex; gap: 4px; }
.oav-dmx button { font: inherit; color: #cfd6e4; background: #141a29; border: 1px solid #2a3348; border-radius: 6px; padding: 2px 8px; cursor: pointer; }
.oav-dmx button[aria-pressed="true"] { color: #0b0e15; background: #ffd166; border-color: #ffd166; }
.oav-dmx button.oav-dmx-connect { color: #ffd166; border-color: #8a6d1f; }
.oav-dmx-status, .oav-dmx-u { color: #9aa5bd; }
.oav-dmx-status[data-state="open"], .oav-dmx-status[data-state="sim"] { color: #37c978; }
.oav-dmx-status[data-state="closed"], .oav-dmx-status[data-state="unsupported"] { color: #ffb02e; }
.oav-dmx-read { margin-left: auto; color: #9aa5bd; min-width: 18ch; text-align: right; }
.oav-dmx-fixtures { display: flex; gap: 6px; flex-wrap: wrap; }
.oav-dmx-fx { position: relative; width: 58px; height: 46px; border-radius: 8px; border: 1px solid #2a3348; overflow: hidden; background: #000; }
.oav-dmx-fx span { position: absolute; left: 4px; bottom: 2px; font-size: 10px; color: #fff; text-shadow: 0 0 3px #000, 0 0 2px #000; }
.oav-dmx-fx i { position: absolute; left: 50%; top: 50%; width: 2px; height: 18px; margin-left: -1px; background: #fff; border-radius: 1px;
  box-shadow: 0 0 2px #000; transform-origin: 50% 0; }
.oav-dmx-fx em { position: absolute; right: 4px; top: 2px; font-style: normal; font-size: 9px; color: #fff; text-shadow: 0 0 3px #000; }
.oav-dmx canvas { display: block; width: 100%; border-radius: 6px; background: #0b0e15; cursor: crosshair; }
.oav-dmx-guard { color: #9aa5bd; }
.oav-dmx-guard[data-state="holding"] { color: #ffb02e; }
.oav-dmx-guard[data-state="off"] { color: #fff; background: #d7263d; border-radius: 6px; padding: 1px 8px; font-weight: 700; letter-spacing: .06em; }
.oav-dmx[data-guard="off"] { box-shadow: inset 0 0 0 2px #d7263d; }
.oav-dmx-fx[data-held] { outline: 2px solid #ffb02e; outline-offset: -2px; }
.oav-dmx-fx b { position: absolute; left: 4px; top: 2px; font-size: 9px; font-weight: 700; color: #ffd166; text-shadow: 0 0 3px #000; }
`;

/**
 * Put a DMX monitor in `el`: fixture swatches and the 512-channel grid of one universe (tabs when there are several).
 * @param {HTMLElement} el
 * @param {object} o
 * @param {import('./patch.js?v=7229c5d3').Patch} o.patch   the fixtures to draw and to name the channels after
 * @param {object} [o.transport]  a dmxTransport() result: its kind, status and flash guard show; a serial one gets a Connect button
 * @param {object} [o.engine]     the DmxEngine: the fixtures its per-fixture flash cap slows are marked
 * @param {number} [o.universe]   the universe the grid starts on (the patch's first by default)
 * @param {string} [o.title='DMX']
 * @returns {{ el: HTMLElement, update(universes?: object): void, select(universe: number): void, look(id: string): object|null, dispose(): void }}
 */
export function mountDmxMonitor(el, { patch, transport = null, engine = null, universe, title = 'DMX' } = {}) {
  if (!el || typeof el.appendChild !== 'function') throw new TypeError('mountDmxMonitor(el, { patch }): el is an element');
  if (!patch || typeof patch.ids !== 'function') throw new TypeError('mountDmxMonitor(el, { patch }): a Patch');
  const doc = el.ownerDocument;
  if (!doc.getElementById('oav-dmx-css')) { const st = doc.createElement('style'); st.id = 'oav-dmx-css'; st.textContent = CSS; doc.head.appendChild(st); }
  const h = (tag, cls, text) => { const x = doc.createElement(tag); if (cls) x.className = cls; if (text !== undefined) x.textContent = text; return x; };

  const root = h('section', 'oav-dmx');
  root.setAttribute('aria-label', `${title} monitor`);
  const head = h('div', 'oav-dmx-head');
  const name = h('b', '', title);
  const tabs = h('div', 'oav-dmx-tabs');
  const status = h('span', 'oav-dmx-status');
  const guardEl = h('span', 'oav-dmx-guard');
  guardEl.setAttribute('role', 'status');
  guardEl.hidden = true;
  const read = h('span', 'oav-dmx-read', 'point at a channel');
  head.append(name, tabs, status, guardEl);
  let connect = null;
  if (transport && transport.kind === 'serial') {
    connect = h('button', 'oav-dmx-connect', 'Connect Enttec Pro');
    connect.type = 'button';
    connect.title = 'Web Serial: the browser asks which port (an Enttec DMX USB Pro or compatible)';
    connect.onclick = () => { transport.connect().catch((e) => { status.textContent = `serial: ${e.message}`; }); };
    head.append(connect);
  }
  head.append(read);
  const fixtures = h('div', 'oav-dmx-fixtures');
  const canvas = h('canvas');
  canvas.setAttribute('role', 'img');
  root.append(head, fixtures, canvas);
  el.appendChild(root);

  const recs = () => patch.fixtures;
  const universesOfPatch = () => [...new Set(recs().map((r) => r.universe))].sort((a, b) => a - b);
  let current = universe ?? universesOfPatch()[0] ?? 1;
  let data = new Map();                 // universe → bytes last shown
  let known = [];
  let dirty = true, hover = -1, lastW = 0;
  let held = new Set(), slowed = new Map(), marks = '', frame = 0;
  const heldUntil = new Map();          // id → the update a held mark lasts until: a light held every other frame must not make the ring blink

  // ---- universe tabs (only when there is more than one)
  const drawTabs = () => {
    const ids = [...new Set([...universesOfPatch(), ...data.keys()])].sort((a, b) => a - b);
    if (ids.join() === known.join()) { for (const b of tabs.children) b.setAttribute('aria-pressed', String(Number(b.dataset.u) === current)); return; }
    known = ids;
    tabs.replaceChildren(...(ids.length > 1 ? ids.map((u) => {
      const b = h('button', '', `U${u}`); b.type = 'button'; b.dataset.u = u; b.setAttribute('aria-pressed', String(u === current));
      b.onclick = () => select(u);
      return b;
    }) : []));
    if (ids.length <= 1) tabs.append(h('span', 'oav-dmx-u', `universe ${current}`));
  };

  // ---- swatches
  const cards = new Map();              // id → { card, mark, last }
  const drawFixtures = () => {
    const list = recs();
    if (list.length !== cards.size || list.some((r) => !cards.has(r.id))) {
      cards.clear();
      fixtures.replaceChildren(...list.map((r) => {
        const card = h('div', 'oav-dmx-fx'); const label = h('span', '', r.id); card.append(label);
        let mark = null;
        if (r.layout.pan || r.layout.tilt) { mark = h('i'); card.append(mark); }
        if (r.universe !== current) card.append(h('em', '', `U${r.universe}`));
        const slow = h('b', '', 'slow'); slow.hidden = true; card.append(slow);
        cards.set(r.id, { card, mark, slow, last: '' });
        return card;
      }));
    }
    for (const r of list) {
      const c = cards.get(r.id);
      const look = fixtureLook(r, data.get(r.universe) || new Uint8Array(SLOTS));
      const bg = cssColor(look.color);
      const isHeld = held.has(r.id), slow = slowed.get(r.id);
      const key = bg + look.pan + look.tilt + isHeld + (slow ? slow.to : '');
      if (key === c.last) continue;
      c.last = key;
      c.card.style.background = bg;
      c.card.style.borderColor = Math.max(...look.color) > 0.02 ? 'rgba(255,255,255,.35)' : '#2a3348';
      c.card.toggleAttribute('data-held', isHeld);
      c.slow.hidden = !slow;
      c.card.title = `${r.id} · ${r.profile.id} ${r.mode.id} · universe ${r.universe}, address ${r.address}–${r.address + r.footprint - 1} · dimmer ${Math.round(look.dimmer * 100)}%`
        + (look.pan !== null ? ` · pan ${look.pan.toFixed(2)}` : '') + (look.tilt !== null ? ` · tilt ${look.tilt.toFixed(2)}` : '')
        + (isHeld ? ' · held back by the flash guard (it flashed 3 times in the last second)' : '')
        + (slow ? ` · slowed by the flash cap: ${slow.hz.toFixed(2)} → ${slow.to.toFixed(2)} Hz (${slow.sources.map((x) => x.name).join(', ')})` : '');
      if (c.mark) {
        // top view: the angle is pan (a full turn across its range), the length is tilt
        c.mark.style.transform = `rotate(${((look.pan ?? 0.5) - 0.5) * 360 + 180}deg)`;
        c.mark.style.height = `${6 + 16 * (look.tilt ?? 0.5)}px`;
      }
    }
  };

  // ---- the channel grid
  const owner = () => {
    const own = new Array(SLOTS).fill(null);
    for (const r of recs()) if (r.universe === current) for (let i = 0; i < r.footprint; i++) own[r.address - 1 + i] = { r, slot: r.mode.slots[i], first: i === 0 };
    return own;
  };
  const drawGrid = () => {
    const w = Math.max(160, canvas.clientWidth || el.clientWidth || 640);
    const cw = w / COLS, ch = Math.max(12, Math.min(18, Math.round(cw * 0.62))), H = ch * ROWS;
    const dpr = Math.min(2, (doc.defaultView && doc.defaultView.devicePixelRatio) || 1);
    if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(H * dpr)) { canvas.width = Math.round(w * dpr); canvas.height = Math.round(H * dpr); canvas.style.height = `${H}px`; }
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, H);
    const bytes = data.get(current) || new Uint8Array(SLOTS);
    const own = owner();
    const looks = new Map();
    ctx.font = `${Math.min(9, ch - 4)}px ui-monospace, SFMono-Regular, Menlo, monospace`;
    ctx.textBaseline = 'middle'; ctx.textAlign = 'center';
    for (let i = 0; i < SLOTS; i++) {
      const x = (i % COLS) * cw, y = Math.floor(i / COLS) * ch, v = bytes[i] / 255, o = own[i];
      ctx.fillStyle = o ? '#131826' : '#0d1017';
      ctx.fillRect(x + 0.5, y + 0.5, cw - 1, ch - 1);
      if (v > 0) {
        let tint = [0.49, 0.65, 1];                       // a channel no fixture claims
        if (o) {
          if (!looks.has(o.r.id)) looks.set(o.r.id, fixtureLook(o.r, bytes));
          const L = looks.get(o.r.id);
          tint = o.slot.type === 'color' ? (EMITTER[o.slot.color] || CMY_TINT[o.slot.color] || [1, 1, 1]) : Math.max(...L.mixed) > 0 ? L.mixed : [1, 0.82, 0.4];
        }
        ctx.globalAlpha = 0.85; ctx.fillStyle = cssColor(tint);
        const bh = Math.max(1, (ch - 1) * v);
        ctx.fillRect(x + 0.5, y + ch - 0.5 - bh, cw - 1, bh);
        ctx.globalAlpha = 1;
        if (cw >= 16) {
          // dark digits only on a tall bar that is light itself (a full blue bar keeps white digits)
          const light = 0.2126 * tint[0] + 0.7152 * tint[1] + 0.0722 * tint[2] > 0.5;
          ctx.fillStyle = v > 0.55 && light ? '#0b0e15' : '#fff';
          ctx.shadowColor = v > 0.55 && light ? 'transparent' : 'rgba(0,0,0,.9)'; ctx.shadowBlur = 2;
          ctx.fillText(String(bytes[i]), x + cw / 2, y + ch / 2 + 0.5);
          ctx.shadowBlur = 0;
        }
      }
      if (o && o.first) { ctx.fillStyle = '#ffd166'; ctx.fillRect(x + 0.5, y + 0.5, 1.5, ch - 1); }
      if (i === hover) { ctx.strokeStyle = '#fff'; ctx.lineWidth = 1; ctx.strokeRect(x + 1, y + 1, cw - 2, ch - 2); }
    }
    const lit = [...bytes].filter((b) => b > 0).length;
    canvas.setAttribute('aria-label', `universe ${current}: ${lit} of 512 channels above 0`);
    lastW = w;
  };
  const readout = () => {
    if (hover < 0) { read.textContent = 'point at a channel'; return; }
    const o = owner()[hover], v = (data.get(current) || [])[hover] || 0;
    read.textContent = `${current}/${hover + 1} = ${v}` + (o ? ` · ${o.r.id} ${o.slot.key}` : ' · not patched');
  };
  canvas.addEventListener('mousemove', (e) => {
    const b = canvas.getBoundingClientRect(), cw = b.width / COLS, ch = b.height / ROWS;
    const i = Math.floor((e.clientY - b.top) / ch) * COLS + Math.floor((e.clientX - b.left) / cw);
    if (i !== hover) { hover = i >= 0 && i < SLOTS ? i : -1; dirty = true; readout(); }
  });
  canvas.addEventListener('mouseleave', () => { hover = -1; dirty = true; readout(); });

  const drawStatus = () => {
    if (!transport) { status.textContent = ''; return; }
    const s = transport.status;
    status.dataset.state = s;
    const what = transport.kind === 'sim' ? 'sim · no hardware' : transport.kind === 'bridge' ? `out-bridge · ${s}` : `Web Serial · ${s}`;
    if (!status.textContent.startsWith('serial: ') || s === 'open') status.textContent = what;
    if (connect) connect.hidden = s === 'open' || s === 'connecting' || s === 'unsupported';
  };

  // the flash guard of the transport, every frame: held fixtures, and OFF for as long as it is off
  const drawGuard = () => {
    const g = transport && transport.flashGuard;
    let now = new Set(), next = new Map();
    if (!g) { guardEl.hidden = true; root.removeAttribute('data-guard'); }
    else if (!g.on) {
      guardEl.hidden = false; guardEl.dataset.state = 'off'; root.dataset.guard = 'off';
      guardEl.textContent = 'FLASH GUARD OFF';
      guardEl.title = 'This transport was made with { flashGuard: false }: nothing holds a light to 3 flashes a second. Flashing faster can bring on a seizure in people with photosensitive epilepsy.';
    } else {
      guardEl.hidden = false; root.dataset.guard = 'on';
      for (const id of g.held || []) heldUntil.set(id, frame + 24);       // about 0.6 s at 40 frames a second
      for (const [id, until] of heldUntil) if (until <= frame) heldUntil.delete(id);
      const list = [...heldUntil.keys()];
      if (g.unit === 'fixture') now = new Set(list);
      guardEl.dataset.state = list.length ? 'holding' : 'on';
      guardEl.textContent = list.length ? `flash guard · holding ${list.slice(0, 4).join(', ')}${list.length > 4 ? ` +${list.length - 4}` : ''}` : `flash guard · ${g.maxFlashHz} Hz per ${g.unit}`;
      guardEl.title = g.unit === 'fixture'
        ? `No fixture may flash more than ${g.maxFlashHz} times in any second: a light that would is held where it is until the second has room.`
        : `No channel may flash more than ${g.maxFlashHz} times in any second. Per channel, because the transport has no patch: give it { patch } to guard each fixture's light.`;
    }
    if (engine && typeof engine.describe === 'function') for (const x of engine.describe().slowed || []) next.set(x.id, x);
    const m = [...now].join() + '|' + [...next].map(([id, x]) => id + x.to).join();
    if (m !== marks) { marks = m; held = now; slowed = next; dirty = true; for (const c of cards.values()) c.last = ''; }
  };
  const delivered = () => (transport && typeof transport.bytes === 'function' ? (transport.universes || []).map((u) => [u, transport.bytes(u)]) : []);

  function select(u) { current = u; dirty = true; cards.clear(); drawTabs(); readout(); }
  function update(universes) {
    frame++;
    for (const [id, bytes] of universes === undefined ? delivered() : listOf(universes)) {
      const prev = data.get(id);
      if (!prev || prev.length !== bytes.length || prev.some((b, i) => b !== bytes[i])) { data.set(id, Uint8Array.from(bytes)); dirty = true; }
    }
    drawStatus();
    drawGuard();
    drawTabs();
    const w = canvas.clientWidth || el.clientWidth;
    if (!dirty && w === lastW) return;
    dirty = false;
    drawFixtures();
    drawGrid();
  }
  const un = transport && typeof transport.onStatus === 'function' ? transport.onStatus(drawStatus) : null;
  drawStatus(); drawGuard(); drawTabs(); drawFixtures(); drawGrid();
  /** What one fixture shows in the bytes the monitor last got (fixtureLook): { color, mixed, dimmer, pan, tilt, strobe }, or null. */
  const look = (id) => { const r = patch.get(id); return r ? fixtureLook(r, data.get(r.universe) || new Uint8Array(SLOTS)) : null; };
  return { el: root, update, select, look, dispose() { un?.(); root.remove(); } };
}
