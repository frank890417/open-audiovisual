// @openav/tile · join — this screen joins the table: one room on the relay, one clock, one layout.
//
//   const tile = joinTile({ room: 'desk', signals });   // ?room=desk in the address does the same
//   tile.view            // where this screen sits on the shared canvas (soloView until a photo placed it)
//   tile.time()          // the shared show clock, seconds — every screen reads the same number at the same moment
//   tile.seed            // the shared seed
//
// A tile is a `controller` in a relay room (packages/relay; the hub is unchanged). It tells the room who it is with
// one continuous signal, `tile/<id>/hello` = { id, w, h, dpr, screen, fullscreen, wake } (re-sent every second, so a
// camera page that opens late still hears it). The camera page is the room's `runner` and answers with standing
// config, which the relay replays to every screen that joins later:
//   tile/roster   { grid, devices: [{ id, index, w, h }] }  each screen's number (its markers) and the grid they use
//   tile/mode     'markers' | 'show'                         paint markers for the photo, or play
//   tile/layout   layout.json (solve.js)                     where every screen is
//   tile/show     { seed, start }                            the show's seed and its start on the shared clock
// The clock: the relay already answers every ping with its own time ({ type: 'pong', t, server }); a tile pings a few
// times and keeps the offset of the quickest round trip (clock.js). Nothing else travels: every screen computes its
// own frame from the same time and the same seed.
//
// The first tap is the one user gesture a browser allows for fullscreen and the screen wake lock, so the page opens
// on a card that asks for it. iPhone Safari has no fullscreen for pages (add the page to the home screen instead);
// the wake lock is a backup for the system setting (Auto-Lock: Never), not a replacement.
//
// Into a show's Signals: tile/markers (0 | 1, the camera page's mode), tile/synced (0 | 1), tile/layout (pulse).

import { RelayClient } from '../relay/index.js';
import { ClockSync } from './clock.js';
import { tileView, soloView } from './view.js';
import { validateLayout } from './solve.js';
import { drawMarkers, GRID_DEFAULTS } from './marker.js';

export const TILE_KEYS = Object.freeze({ roster: 'tile/roster', mode: 'tile/mode', layout: 'tile/layout', show: 'tile/show' });
export const helloName = (id) => `tile/${id}/hello`;
export const HELLO_RE = /^tile\/([\w-]{1,64})\/hello$/;

/** The param that switches a tiled world between "paint markers" and "play"; route tile/markers to it (TILE_ROUTES). */
export const TILE_PARAMS = Object.freeze([
  Object.freeze({ key: 'tileMarkers', label: 'Tile markers', min: 0, max: 1, def: 0, step: 1, options: ['show', 'markers'] }),
]);
export const TILE_ROUTES = Object.freeze([Object.freeze({ source: 'tile/markers', target: 'tileMarkers' })]);

const q = (k) => { try { return new URLSearchParams(location.search).get(k); } catch { return null; } };
const cleanId = (s) => String(s || '').replace(/[^\w-]/g, '').slice(0, 24);
const rnd = () => Math.random().toString(36).slice(2, 7);

/** This screen's id: ?id= in the address, else one kept in localStorage (so a reload keeps its place on the table). */
export function tileId(storage = safeStorage()) {
  const fromUrl = cleanId(q('id'));
  if (fromUrl) return fromUrl;
  let id = null;
  try { id = cleanId(storage?.getItem('oav.tile.id')); } catch {}
  if (!id) { id = 't' + rnd(); try { storage?.setItem('oav.tile.id', id); } catch {} }
  return id;
}
function safeStorage() { try { return globalThis.localStorage || null; } catch { return null; } }

/**
 * A RelayClient that also keeps the shared clock: it pings the relay a few times on connect and then every 2 s, and
 * files each pong (which carries the relay's own time) into a ClockSync. Used by tiles and by the camera page.
 */
export class TileLink extends RelayClient {
  constructor({ clock = new ClockSync(), onClock = null, ...o } = {}) {
    super(o);
    this.clock = clock; this.onClock = onClock;
    this._pings = new Map(); this._pingTimer = null; this._pingCount = 0;
  }
  connect() {
    super.connect();
    if (!this._pingTimer) {
      // ten quick pings to find a short round trip early, then one every 2 s to follow drift
      this._pingTimer = setInterval(() => { if (this._pingCount++ < 10 || this._pingCount % 10 === 0) this.ping(); }, 200);
    }
    return this;
  }
  close() { clearInterval(this._pingTimer); this._pingTimer = null; super.close(); }
  ping() {
    if (!this.open) return;
    const t = this.clock.local();
    this._pings.set(t, true);
    for (const k of this._pings.keys()) if (t - k > 10000) this._pings.delete(k);
    this._raw({ type: 'ping', t });
  }
  // RelayClient files the pong as a latency; the relay's `server` time in it is what the clock needs
  _onMessage(data) {
    if (typeof data === 'string' && data.includes('"pong"')) {
      let m = null; try { m = JSON.parse(data); } catch {}
      if (m && m.type === 'pong' && typeof m.server === 'number' && this._pings.delete(m.t)) {
        this.clock.add(m.t, m.server, this.clock.local());
        this.onClock?.(this.clock);
      }
    }
    super._onMessage(data);
  }
}

const CSS = `
.tile-ui{position:fixed;inset:0;z-index:60;display:grid;place-items:center;background:rgba(8,9,12,.94);color:#dfe5f0;
  font:15px/1.45 system-ui,-apple-system,sans-serif;padding:20px;text-align:center}
.tile-ui[hidden],.tile-chip[hidden],.tile-fs[hidden]{display:none}
.tile-ui .card{max-width:440px}
.tile-ui h1{font-size:20px;margin:0 0 6px}
.tile-ui .mono{font:13px ui-monospace,monospace;color:#8f9bb3}
.tile-ui button{margin:22px 0 12px;width:100%;padding:22px 0;border:0;border-radius:18px;background:#7ea6ff;color:#001;font:800 20px system-ui;cursor:pointer}
.tile-ui p{margin:6px 0;color:#8f9bb3;font-size:13px}
.tile-markers{position:fixed;left:0;top:0;width:100%;height:100%;z-index:50;display:none;background:#fff}
.tile-chip{position:fixed;left:8px;top:8px;z-index:55;padding:3px 9px;border-radius:9px;background:rgba(10,12,17,.78);color:#cfd6e4;
  font:11px ui-monospace,monospace;pointer-events:none;transition:opacity .6s}
.tile-chip.quiet{opacity:0}
.tile-fs{position:fixed;right:10px;top:10px;z-index:56;width:40px;height:40px;border-radius:12px;border:1px solid #283044;
  background:rgba(10,12,17,.8);color:#cfd6e4;font:18px system-ui;cursor:pointer}
`;

/**
 * Join the table.
 * @param {object} [o]
 * @param {string} [o.room]        relay room (default ?room=, else 'tile')
 * @param {string} [o.url]         relay websocket URL (default this server's /relay, or ?relay=)
 * @param {string} [o.id]          this screen's id (default tileId())
 * @param {object} [o.signals]     a show's Signals: tile/markers, tile/synced, tile/layout are published into it
 * @param {HTMLElement} [o.container]  where the card, the marker layer and the status chip go (default body)
 * @param {boolean} [o.ui=true]    the join card and the status chip
 */
export function joinTile({ room = q('room') || 'tile', url = null, id = tileId(), signals = null, container = null, ui = true, storage = safeStorage(), Link = TileLink } = {}) {
  room = String(room).replace(/[^\w-]/g, '').slice(0, 32) || 'tile';
  const key = `oav.tile.${room}`;
  const saved = (() => { try { return JSON.parse(storage?.getItem(key) || 'null') || {}; } catch { return {}; } })();
  const subs = new Map();
  const emit = (ev, v) => { for (const cb of subs.get(ev) || []) { try { cb(v, tile); } catch (e) { console.error('[tile]', ev, e); } } };
  const save = () => { try { storage?.setItem(key, JSON.stringify({ layout: tile.layout, show: tile.show })); } catch {} };

  // the page usually joins before createShow() has made its Signals: tile.attach() them when they exist
  function attachSignals(s) {
    signals = s || null;
    if (!signals) return;
    signals.define('tile/markers', { min: 0, max: 1, source: 'tile', description: 'the camera page asks for markers' });
    signals.define('tile/synced', { min: 0, max: 1, source: 'tile', description: 'the shared clock is known' });
    signals.define('tile/layout', { kind: 'pulse', source: 'tile', description: 'a new layout arrived' });
    signals.set('tile/markers', tile.mode === 'markers' ? 1 : 0);
    signals.set('tile/synced', tile.clock.ready ? 1 : 0);
  }

  const tile = {
    id, room,
    index: null,
    grid: { ...GRID_DEFAULTS },
    layout: null,
    view: null,
    calibrated: false,
    mode: 'show',
    show: saved.show && Number.isFinite(saved.show.start) ? saved.show : null,
    driven: false,               // a tileWorld drives the marker layer through its param instead of the mode directly
    wake: typeof navigator !== 'undefined' && navigator.wakeLock ? 'off' : 'none',
    get seed() { return this.show?.seed ?? (Number(q('seed')) || 1); },
    get synced() { return this.clock.ready; },
    /** the shared clock, ms */
    now() { return this.clock.now(); },
    /** shared show seconds: since the camera page pressed play, or since 1970 before it did (still the same on every screen) */
    time() { return (this.clock.now() - (this.show?.start ?? 0)) / 1000; },
    /** this screen's drawing area in device pixels (what the markers are drawn in, and what the layout measures) */
    size() {
      const dpr = globalThis.devicePixelRatio || 1;
      return { w: Math.round(innerWidth * dpr), h: Math.round(innerHeight * dpr), dpr };
    },
    on(ev, cb) { if (!subs.has(ev)) subs.set(ev, new Set()); subs.get(ev).add(cb); return () => subs.get(ev)?.delete(cb); },
    /** publish tile/markers, tile/synced, tile/layout into a show's Signals (also: joinTile({ signals })) */
    attach(s) { attachSignals(s); return tile; },
    /** show or hide the marker layer by hand (a tileWorld does it from its param) */
    markers(on) { setMarkers(!!on); },
    /**
     * Keep a Timeline on the shared clock: call it before timeline.advance(dt) (createShow's onFrame does). The
     * playhead is put where the shared clock was one frame ago, so advance(dt) lands on the shared time and fires the
     * scenes and cues it passes; a jump (the first sync, a lap of the loop) is a seek. Every screen's automation then
     * reads the same values.
     */
    syncTimeline(timeline, dt = 0) {
      if (!this.clock.ready || !this.show) return false;
      const total = timeline.total;
      let T = this.time();
      T = timeline.loop ? ((T % total) + total) % total : Math.max(0, Math.min(total, T));
      if (!timeline.playing && !timeline.holding) timeline.play();
      const prev = Math.max(0, T - dt * (timeline.rate || 1));
      if (Math.abs(timeline.t - prev) > 0.25) timeline.seek(prev, 'jump'); else timeline.t = prev;
      return true;
    },
    status() {
      return { room, id, open: link.open, rtt: link.clock.rtt, synced: link.clock.ready, index: tile.index, calibrated: tile.calibrated,
        mode: tile.mode, fullscreen: isFullscreen(), wake: tile.wake, size: tile.size() };
    },
    close() { link.close(); removeEventListener('resize', onResize); document.removeEventListener('visibilitychange', onVisible); root?.remove(); },
  };

  // ---------------------------------------------------------------- the view
  function refreshView() {
    const { w, h } = tile.size();
    const v = tile.layout ? tileView(tile.layout, id) : null;
    const was = tile.calibrated;
    tile.calibrated = !!(v && v.ok && Math.abs(v.device.w - w) <= 2 && Math.abs(v.device.h - h) <= 2);
    tile.view = tile.calibrated ? v : soloView(w, h, id);
    if (was !== tile.calibrated || tile.calibrated) emit('view', tile.view);
  }
  function takeLayout(L, { pulse = true } = {}) {
    const ok = validateLayout(L);
    if (!ok.ok) { console.warn('[tile] layout refused:', ok.errors.join('; ')); return; }
    tile.layout = L;
    save();
    refreshView();
    if (pulse) signals?.pulse('tile/layout', { devices: L.devices.length, reference: L.reference, placed: tile.calibrated });
    emit('layout', L);
    paint();
  }

  // ---------------------------------------------------------------- the relay
  const link = new Link({
    role: 'controller', room, id, url,
    onClock: (c) => { signals?.set('tile/synced', c.ready ? 1 : 0); chip(); },
    onStatus: () => chip(),
    onConfig: (k, data) => {
      if (k === TILE_KEYS.roster && data && Array.isArray(data.devices)) {
        const me = data.devices.find((d) => d && d.id === id);
        tile.index = me && Number.isInteger(me.index) ? me.index : null;
        tile.grid = { ...GRID_DEFAULTS, ...(data.grid || {}) };
        emit('roster', data); paint(); chip();
      } else if (k === TILE_KEYS.mode) {
        tile.mode = data === 'markers' ? 'markers' : 'show';
        signals?.set('tile/markers', tile.mode === 'markers' ? 1 : 0);
        if (!tile.driven) setMarkers(tile.mode === 'markers');
        emit('mode', tile.mode); chip();
      } else if (k === TILE_KEYS.layout) takeLayout(data);
      else if (k === TILE_KEYS.show && data && Number.isFinite(data.start)) {
        tile.show = { seed: Number.isFinite(data.seed) ? data.seed : 1, start: data.start };
        save(); emit('show', tile.show);
      }
    },
  });
  tile.link = link; tile.clock = link.clock;
  attachSignals(signals);
  const hello = () => {
    const { w, h, dpr } = tile.size();
    const sw = typeof screen !== 'undefined' ? [Math.round(screen.width * dpr), Math.round(screen.height * dpr)] : null;
    link.set(helloName(id), { v: 1, id, w, h, dpr, screen: sw, css: [innerWidth, innerHeight], fullscreen: isFullscreen(), wake: tile.wake });
  };

  // ---------------------------------------------------------------- the page: card, marker layer, chip
  let root = null, card = null, layer = null, chipEl = null, fsBtn = null, markersOn = false;
  const host = container || document.body;
  if (typeof document !== 'undefined') {
    root = document.createElement('div');
    root.className = 'tile-root';
    const st = document.createElement('style'); st.textContent = CSS; root.appendChild(st);
    layer = document.createElement('canvas'); layer.className = 'tile-markers'; root.appendChild(layer);
    if (ui) {
      chipEl = document.createElement('div'); chipEl.className = 'tile-chip'; root.appendChild(chipEl);
      fsBtn = document.createElement('button'); fsBtn.className = 'tile-fs'; fsBtn.textContent = '⛶'; fsBtn.title = 'fullscreen + keep awake'; fsBtn.hidden = true;
      fsBtn.onclick = () => wakeUp();
      root.appendChild(fsBtn);
      card = document.createElement('div'); card.className = 'tile-ui';
      card.innerHTML = `<div class="card"><h1>Tile · room <span class="mono"></span></h1><div class="mono tile-who"></div>
        <button type="button">Tap to join</button>
        <p>Fullscreen and keep the screen awake. Then lay this screen flat on the table.</p>
        <p>iPhone: Share → Add to Home Screen for fullscreen, and Settings → Display &amp; Brightness → Auto-Lock → Never.</p></div>`;
      card.querySelector('h1 .mono').textContent = room;
      card.querySelector('button').onclick = () => { wakeUp(); card.hidden = true; chip(); };
      root.appendChild(card);
    }
    host.appendChild(root);
  }
  function isFullscreen() { return typeof document !== 'undefined' && !!(document.fullscreenElement || document.webkitFullscreenElement); }
  // inside a tap: both requests must start before the handler returns
  function wakeUp() {
    const el = document.documentElement;
    if (!isFullscreen()) { try { const r = (el.requestFullscreen || el.webkitRequestFullscreen)?.call(el, { navigationUI: 'hide' }); r?.catch?.(() => {}); } catch {} }
    takeWakeLock();
  }
  let lock = null;
  function takeWakeLock() {
    if (!navigator.wakeLock) { tile.wake = 'none'; hello(); return; }
    navigator.wakeLock.request('screen').then((l) => {
      lock = l; tile.wake = 'on'; hello(); chip();
      l.addEventListener?.('release', () => { tile.wake = 'off'; hello(); chip(); });
    }).catch(() => { tile.wake = 'off'; hello(); chip(); });
  }
  // the OS drops the wake lock when the tab hides; ask again on return (Safari may want a tap: the ⛶ button)
  const onVisible = () => { if (document.visibilityState === 'visible' && tile.wake !== 'none' && (!lock || lock.released)) takeWakeLock(); };
  document.addEventListener('visibilitychange', onVisible);
  document.addEventListener('fullscreenchange', () => { hello(); chip(); });
  document.addEventListener('webkitfullscreenchange', () => { hello(); chip(); });

  function setMarkers(on) {
    if (on === markersOn) return;
    markersOn = on;
    if (layer) layer.style.display = on ? 'block' : 'none';
    paint(); chip();
  }
  function paint() {
    if (!layer || !markersOn) return;
    const { w, h } = tile.size();
    if (layer.width !== w || layer.height !== h) { layer.width = w; layer.height = h; }
    const ctx = layer.getContext('2d');
    if (tile.index == null) {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#555'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.font = `${Math.round(Math.min(w, h) / 22)}px system-ui, sans-serif`;
      ctx.fillText('waiting for the camera page to number this screen', w / 2, h / 2);
      ctx.fillText(id, w / 2, h / 2 + Math.min(w, h) / 14);
      return;
    }
    drawMarkers(ctx, { w, h, index: tile.index, grid: tile.grid, label: `#${tile.index} · ${id}` });
  }
  function chip() {
    if (!chipEl) return;
    const c = link.clock;
    const s = link.open ? '●' : '○';
    chipEl.textContent = `${s} ${room} · ${tile.index == null ? 'no number yet' : '#' + tile.index} · ${c.ready ? Math.round(c.rtt) + ' ms' : 'clock…'} · `
      + (tile.calibrated ? 'placed' : tile.layout ? 'not in the photo / size changed' : 'no layout');
    // out of the way while the show plays on a placed screen
    chipEl.classList.toggle('quiet', !markersOn && tile.calibrated && link.open);
    if (fsBtn) {
      // after the card: offer the tap again when fullscreen was left or the wake lock was lost
      const el = document.documentElement, lostFs = !!(el.requestFullscreen || el.webkitRequestFullscreen) && !isFullscreen();
      fsBtn.hidden = !card?.hidden || !(lostFs || tile.wake === 'off');
    }
    const who = card?.querySelector('.tile-who');
    if (who) { const { w, h } = tile.size(); who.textContent = `${id} · ${w}×${h} px`; }
  }
  let rT = null;
  const onResize = () => { clearTimeout(rT); rT = setTimeout(() => { refreshView(); hello(); paint(); chip(); emit('resize', tile.size()); }, 120); };
  addEventListener('resize', onResize);

  // a layout kept from before this reload: in place at once, if this screen has not changed size
  if (saved.layout) takeLayout(saved.layout, { pulse: false }); else refreshView();
  link.connect();
  hello();
  chip();
  return tile;
}
