// @openav/remote · host — the SHOW side of a phone remote.
//
//   const remote = mountRemoteHost({ signals, params, mapper, world, room: 'main' });
//
// What it does, so a World stays ignorant of phones:
//   1. connects to the relay as the room's *runner*
//   2. pipes every phone signal into `signals` (+ `phone/any/…` alias, see relay/signals.js)
//   3. builds the control surface from the World — its own layout if it ships
//      `world.surface`, otherwise autoSurface(world.params) — and publishes it
//      as relay config, so any phone that joins gets the right panel
//   4. adds the surface → param routes to the Mapper (continuous control stays
//      on params: AGENTS.md rule #1)
//   5. echoes resolved param values back (feedback) so the phone's faders follow
//      the timeline and other controllers, and meters show the work breathing
// Wire it into a show with `createShow({ modules: { remote: true } })`.

import { RelayClient, bindSignals } from '../relay/index.js?v=2399f6b';
import { autoSurface, feedbackFor, normalizeLayout, routesFromLayout } from '../surface/index.js?v=2399f6b';
import { linkControllers } from '../midi/link.js?v=2399f6b';
import { relayUrlFor, phoneUrl, PUBLIC_RELAY } from './relay-pick.js?v=2399f6b';
import { qrSvg } from './qr.js?v=2399f6b';
import { STACK_QUERY } from '../show/layout.js?v=2399f6b';

/**
 * @param {object} o
 * @param {import('../core/src/signals.js?v=2399f6b').Signals} o.signals
 * @param {import('../core/src/params.js?v=2399f6b').Params} o.params
 * @param {import('../mapping/index.js?v=2399f6b').Mapper} o.mapper
 * @param {{name?:string, params?:object[], surface?:object}} [o.world]
 * @param {string} [o.room='default']
 * @param {object} [o.auto]     autoSurface options (pairs, meters, style, perPage…)
 * @param {object} [o.surface]  an explicit layout (wins over world.surface)
 * @param {number} [o.feedbackHz=10]
 * @param {string} [o.url]      relay to use instead of this page's own /relay: 'wss://host/relay' (role, room and id are appended). createShow
 *        fills it from pickRelay(): the public relay on a static host, ?relay=… when given, null on `node serve.js`
 * @param {'local'|'public'|'custom'} [o.mode]  what pickRelay() decided; the join card words its status by it
 * @param {import('../midi/manager.js?v=2399f6b').MidiControllers} [o.controllers]  on-screen MIDI controllers: the phone's
 *        MIDI tab shows the same device (config "midi"), mirrors this machine's hardware (feedback), and its
 *        plays are mirrored on this screen
 */
export function mountRemoteHost({ signals, params, mapper, world = null, room = 'default', auto = {}, surface = null, feedbackHz = 10, url = null, mode = null, controllers = null } = {}) {
  const schema = params?.schema?.length ? params.schema : (world?.params || []);
  const layoutIn = surface || world?.surface || null;
  let built;
  if (layoutIn) {
    const routes = routesFromLayout(normalizeLayout(layoutIn), schema);
    built = { layout: layoutIn, routes, bindings: bindingsFromRoutes(routes, schema) };
  } else built = autoSurface(schema, { title: world?.name || '', ...auto });

  // routes: add the ones the mapper does not already have (a saved profile may have edits)
  const have = new Set(mapper.routes.map((r) => r.source + '→' + r.target));
  for (const r of built.routes) if (!have.has(r.source + '→' + r.target)) mapper.addRoute(r);

  // a relay shared with strangers needs a runner id of its own: two tabs of one show must not both be "show"
  const id = url ? 'show-' + Math.random().toString(36).slice(2, 6) : 'show';
  const relay = new RelayClient({ role: 'runner', room, id, url: url ? relayUrlFor(url, { role: 'runner', room, id }) : undefined, onStatus: (c) => host.onStatus?.(c) });
  bindSignals(relay, signals);
  const publish = () => { relay.config('surface', { layout: built.layout }); if (controllers) relay.config('midi', { profile: controllers.current.id }); };
  const midiLink = controllers ? linkControllers(relay, signals, controllers) : null;
  const prevStatus = relay.onStatus;
  relay.onStatus = (c) => { if (c.status === 'open' && !host._published) { host._published = true; publish(); } if (c.status !== 'open') host._published = false; prevStatus?.(c); };

  let acc = 0;
  const host = {
    relay, layout: built.layout, routes: built.routes, bindings: built.bindings, publish, room, relayUrl: url, relayMode: mode || (url ? 'custom' : 'local'), onStatus: null,
    /** Call per frame with the resolved param state. */
    frame(dt, state) {
      acc += dt; if (acc < 1 / feedbackHz) return; acc = 0;
      for (const f of feedbackFor(state, built.bindings)) relay.feedback(f.name, f.value);
      midiLink?.flush();
    },
    connect() { relay.connect(); return host; },
    dispose() { midiLink?.dispose(); relay.close(); },
  };
  return host;
}

/** For hand-written layouts: derive feedback bindings from the routes' targets. */
function bindingsFromRoutes(routes, schema) {
  const by = new Map(schema.map((p) => [p.key, p]));
  return routes.filter((r) => by.has(r.target) && !by.get(r.target).pulse).map((r) => {
    const p = by.get(r.target);
    return { param: r.target, name: r.source, min: p.min ?? 0, max: p.max ?? 1 };
  });
}

/** A small card on the show page: a QR code and the URL a phone should open, and who is connected.
 *  Room names are 1–32 chars of [A-Za-z0-9_-]. On a phone held upright the card starts folded (the stage is small, and
 *  you are already on the phone); tap it to open. */
export function mountJoinCard(parent, host) {
  const el = document.createElement('div');
  el.style.cssText = 'position:absolute;left:12px;top:12px;z-index:5;max-width:min(80%,420px);padding:8px 12px;border-radius:12px;background:rgba(10,12,17,.78);' +
    'border:1px solid #283044;color:#cfd6e4;font:12px/1.5 ui-monospace,Menlo,monospace;backdrop-filter:blur(6px);cursor:pointer;';
  el.innerHTML = '<div style="color:#8691a8;font-size:10.5px;letter-spacing:.08em">PHONE / IPAD REMOTE</div>' +
    '<div class="b" style="display:flex;gap:12px;align-items:flex-start;margin-top:4px">' +
    '<div class="q" style="flex:none;border-radius:6px;overflow:hidden;background:#fff;line-height:0"></div>' +
    '<div class="t" style="min-width:0"><div class="u" style="word-break:break-all;color:#7ea6ff"></div></div></div>' +
    '<div class="s" style="color:#8691a8"></div>';
  parent.appendChild(el);
  const $ = (c) => el.querySelector('.' + c);
  const dir = new URL('../remote/', import.meta.url);
  const shared = host.relayMode === 'public' || host.relayMode === 'custom';
  const paint = async () => {
    let u = new URL(dir.pathname.replace(/\/+$/, '/'), location.origin);
    try {
      if (/^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname)) {
        const info = await (await fetch('/__info')).json();
        if (info.lan?.[0]) u = new URL(`${location.protocol}//${info.lan[0]}:${info.port}${u.pathname}`);
      }
    } catch {}
    const href = phoneUrl({ base: u.href, room: host.room, relay: shared ? host.relayUrl : null });
    $('u').textContent = href;
    try { $('q').innerHTML = qrSvg(href, { ecc: 'M', margin: 2, scale: 3 }); } catch { $('q').style.display = 'none'; }   // too long for the encoder: the URL is still there
  };
  paint();
  host.onStatus = (c) => {
    $('s').textContent = c.status === 'open'
      ? `relay ok · ${c.peers.controllers} phone${c.peers.controllers === 1 ? '' : 's'} · room ${host.room}${host.relayMode === 'public' ? ' · public relay' : ''}`
      : shared ? `can't reach the relay (${host.relayUrl || PUBLIC_RELAY}) — retrying` : 'relay offline — is it `node serve.js`?';
  };
  let open = !(typeof matchMedia === 'function' && matchMedia(STACK_QUERY).matches);
  const fold = () => { $('b').style.display = open ? 'flex' : 'none'; };
  fold();
  el.addEventListener('click', (e) => { if (e.target.closest('a')) return; open = !open; fold(); });
  return el;
}
