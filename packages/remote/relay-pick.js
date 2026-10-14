// @openav/remote · relay-pick — which relay a show's phone remote talks to, and which room.
//
//   const pick = pickRelay({ hostname: location.hostname, search: location.search, declared: { room: 'main' }, storage });
//   → { mode, url, room, shared }
//
//   mode 'local'   the page is served from this machine or its LAN (node serve.js): the same-origin /relay. url = null.
//   mode 'public'  a static host (openaudiovisual.com, GitHub Pages…) has no relay of its own: use the public one,
//                  with a random room kept in this browser, so two visitors never land in each other's show.
//   mode 'custom'  ?relay=wss://… in the URL, or `modules: { remote: { relay: 'wss://…' } }` in the show.
//   mode 'off'     ?relay=off, or `relay: false` — no remote at all.
//
// Pure (no DOM, no network), so the choice is a test, not a guess. createShow() calls it; so can your own page.

export const PUBLIC_RELAY = 'wss://remote.cheyuwu.com/relay';
export const ROOM_KEY = 'oav.show.room';
const ROOM_RE = /^[\w-]{1,32}$/;
const WS_RE = /^wss?:\/\/[^\s/]+/i;

/** True for the machine itself and for private LAN addresses — where `node serve.js` could be running. */
export function isLocalHost(hostname = '') {
  const h = String(hostname).toLowerCase().replace(/^\[|\]$/g, '');
  if (!h) return true;                                           // file:// and the like
  if (h === 'localhost' || h === '::1' || h.endsWith('.localhost') || h.endsWith('.local')) return true;
  const m = h.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (m) {
    const [a, b] = [Number(m[1]), Number(m[2])];
    return a === 127 || a === 10 || (a === 192 && b === 168) || (a === 172 && b >= 16 && b <= 31) || (a === 169 && b === 254);
  }
  return /^f[cd][0-9a-f]{2}:/.test(h) || /^fe80:/.test(h);       // IPv6 unique-local / link-local
}

export function cleanRoom(r) {
  const s = String(r ?? '').replace(/[^\w-]/g, '').slice(0, 32);
  return ROOM_RE.test(s) ? s : '';
}

/** 'show-' + 10 characters of base 36 (~51 bits when `random` is crypto-backed). `random` returns n bytes — injectable for tests. */
export function randomRoom(random = (n) => globalThis.crypto.getRandomValues(new Uint8Array(n))) {
  let s = '';
  for (const b of random(10)) s += (b % 36).toString(36);
  return 'show-' + s;
}

/**
 * @param {object} o
 * @param {string} [o.hostname]    location.hostname
 * @param {string} [o.search]      location.search
 * @param {{room?:string, relay?:string|false, url?:string}} [o.declared]   what the show declared: modules.remote
 * @param {{getItem:Function, setItem:Function}|null} [o.storage]   where a public-mode room is remembered
 * @param {(n:number)=>ArrayLike<number>} [o.random]
 */
export function pickRelay({ hostname = '', search = '', declared = {}, storage = null, random } = {}) {
  const q = new URLSearchParams(search);
  const qRelay = q.get('relay');
  const qRoom = cleanRoom(q.get('room'));
  const want = qRelay ?? declared.relay ?? declared.url ?? null;

  if (want === false || (typeof want === 'string' && want.toLowerCase() === 'off')) return { mode: 'off', url: null, room: qRoom || cleanRoom(declared.room) || 'default', shared: false };

  let mode, url = null;
  if (typeof want === 'string' && WS_RE.test(want)) { mode = 'custom'; url = want; }
  else if (isLocalHost(hostname)) mode = 'local';
  else { mode = 'public'; url = PUBLIC_RELAY; }

  // A relay several strangers share must not hand them the same room: a declared room name ('main') only applies on a machine of your own.
  const shared = url ? sameRelay(url, PUBLIC_RELAY) : false;
  let room = qRoom;
  if (!room && !shared) room = cleanRoom(declared.room) || 'default';
  if (!room) {
    try { room = cleanRoom(storage?.getItem(ROOM_KEY)); } catch { room = ''; }
    if (!room) { room = randomRoom(random); try { storage?.setItem(ROOM_KEY, room); } catch { /* private window: a fresh room per load */ } }
  }
  return { mode, url, room, shared };
}

function sameRelay(a, b) {
  try { return new URL(a.replace(/^ws/i, 'http')).host === new URL(b.replace(/^ws/i, 'http')).host; } catch { return false; }
}

/** The full websocket URL RelayClient needs when it is given an explicit relay (it appends nothing to `url`). */
export function relayUrlFor(base, { role, room, id }) {
  return base + (base.includes('?') ? '&' : '?') + `role=${role}&room=${encodeURIComponent(room)}&id=${encodeURIComponent(id)}`;
}

/** The address a phone opens: the remote page of the same copy of the framework, in this room, on this relay. */
export function phoneUrl({ base, room, relay = null }) {
  const u = new URL(base);
  u.searchParams.set('room', room);
  if (relay) u.searchParams.set('relay', relay);
  return u.href;
}
