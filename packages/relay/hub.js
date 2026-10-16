// @openav/relay · hub — room-scoped routing, pure logic (no sockets, no Buffer).
//
// The audience-device idea in one sentence: many phones are *controllers*, one
// show page is the *runner*, a laptop backstage is a *monitor* — and they all
// meet in a room whose name is in the QR code. The hub knows only who may talk
// to whom; the transport (server.js) and the meaning of signals (mapping) live
// elsewhere.
//
//   controller → runner + monitor      (sensors, surface widgets, keys)
//   runner     → monitor + controller  ONLY for `feedback` / `config`
//                                       (meters, fader echo, the surface layout)
//   monitor    → nobody
//   leader     → followers            `sync` (frames, state replies: one show on several pages — packages/sync)
//   follower   → leaders              `sync` (hello)
//
// Wire format is the lab-dev relay's, unchanged, so a client written for one
// works against the other:
//   {"type":"signal","name":"phone/ab12/tilt/x","value":0.3,"t":…,"pulse"?:true}
//   {"type":"batch","items":[signal…]}
//   {"type":"ping","t":…}  →  {"type":"pong","t":…,"server":…}
//   {"type":"status","controllers":1,"runners":1,"monitors":0}
// Additions (older clients ignore unknown types):
//   {"type":"feedback","name":"surface/main/level","value":0.4}   runner → controllers
//   {"type":"config","key":"surface","data":{…}}                  runner → controllers, and
//                                                                  replayed to late joiners
//   {"type":"sync","v":1,"kind":"frame","seq":…,"T":…,…}            leader → followers, follower → leaders;
//                                                                  with "to":"<id>" only that peer. The hub does not read
//                                                                  past "to": what a frame means is packages/sync's business.

export const ROLES = ['controller', 'runner', 'monitor', 'leader', 'follower'];
const ROOM_RE = /^[\w-]{1,32}$/;
export const DEFAULT_ROOM = 'default';

export function cleanRoom(r) { return r && ROOM_RE.test(r) ? r : DEFAULT_ROOM; }
export function cleanRole(r) { return ROLES.includes(r) ? r : 'controller'; }

export class RoomHub {
  constructor({ maxMessageChars = 262144 } = {}) {
    this.rooms = new Map();       // name -> {peers:Set, configs:Map(key→raw string)}
    this.maxMessageChars = maxMessageChars;
  }

  _room(name) {
    let r = this.rooms.get(name);
    if (!r) { r = { peers: new Set(), configs: new Map() }; this.rooms.set(name, r); }
    return r;
  }

  counts(room) {
    const c = { controllers: 0, runners: 0, monitors: 0, leaders: 0, followers: 0 };
    const r = this.rooms.get(room);
    if (r) for (const p of r.peers) c[p.role + 's']++;
    return c;
  }

  /** @param {{room?:string, role?:string, id?:string, send:(s:string)=>void}} o */
  join({ room, role, id = '', send }) {
    const peer = { room: cleanRoom(room), role: cleanRole(role), id: String(id).slice(0, 64), send };
    const r = this._room(peer.room);
    r.peers.add(peer);
    this._tell(peer, { type: 'hello', role: peer.role, room: peer.room, id: peer.id, ...this.counts(peer.room) });
    // late joiner gets the runner's standing config (e.g. the surface layout)
    if (peer.role === 'controller') for (const raw of r.configs.values()) this._tellRaw(peer, raw);
    this._status(peer.room);
    return peer;
  }

  leave(peer) {
    const r = this.rooms.get(peer.room);
    if (!r) return;
    r.peers.delete(peer);
    // a room whose runner left forgets its config — a stale layout for a show
    // that is gone is worse than none
    if (!this.counts(peer.room).runners) r.configs.clear();
    if (!r.peers.size) this.rooms.delete(peer.room); else this._status(peer.room);
  }

  /** Handle one inbound text message from `peer`. Returns the parsed message or null. */
  message(peer, raw) {
    if (typeof raw !== 'string' || raw.length > this.maxMessageChars) return null;
    let m; try { m = JSON.parse(raw); } catch { return null; }
    if (!m || typeof m !== 'object') return null;
    switch (m.type) {
      case 'ping': this._tell(peer, { type: 'pong', t: m.t, server: Date.now() }); break;
      case 'hello': {
        // role change mid-connection (the lab protocol allows it)
        const room = this.rooms.get(peer.room);
        if (m.role && ROLES.includes(m.role)) peer.role = m.role;
        if (m.id) peer.id = String(m.id).slice(0, 64);
        if (room) this._status(peer.room);
        break;
      }
      case 'signal': case 'batch':
        if (peer.role === 'controller') this._fan(peer, raw, ['runner', 'monitor']);
        else if (peer.role === 'runner') this._fan(peer, raw, ['monitor']);
        break;
      case 'feedback':
        if (peer.role === 'runner') this._fan(peer, raw, ['controller', 'monitor']);
        break;
      case 'config':
        if (peer.role === 'runner' && typeof m.key === 'string') {
          this._room(peer.room).configs.set(m.key, raw);
          this._fan(peer, raw, ['controller', 'monitor']);
        }
        break;
      case 'sync':
        // several pages, one show: the leader's frames reach the room's followers, a follower's hello reaches its leaders.
        // `to` narrows it to one peer id (a state reply to a late joiner). Nobody else can speak here.
        if (peer.role === 'leader') this._fan(peer, raw, ['follower'], m.to);
        else if (peer.role === 'follower') this._fan(peer, raw, ['leader'], m.to);
        break;
      default: return null;
    }
    return m;
  }

  _fan(from, raw, roles, to) {
    const r = this.rooms.get(from.room);
    if (!r) return;
    const only = typeof to === 'string' && to ? to : null;
    for (const p of r.peers) if (p !== from && roles.includes(p.role) && (only === null || p.id === only)) this._tellRaw(p, raw);
  }
  _status(room) {
    const r = this.rooms.get(room); if (!r) return;
    const raw = JSON.stringify({ type: 'status', room, ...this.counts(room) });
    for (const p of r.peers) this._tellRaw(p, raw);
  }
  _tell(peer, obj) { this._tellRaw(peer, JSON.stringify(obj)); }
  _tellRaw(peer, raw) { try { peer.send(raw); } catch { /* a dead socket is cleaned by its own close handler */ } }
}
