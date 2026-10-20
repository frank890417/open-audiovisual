// @openav/relay · link — MIDI between pages in one room: Strudel in one tab, a p5 sketch in another (or on another
// computer), over the same relay the phones use.
//
//   const link = new MidiLink({ url: 'wss://remote.cheyuwu.com/relay', room: 'class4', onMessages: (list) => … });
//   link.connect();
//   link.send([0x90, 60, 100], whenMs);   // whenMs: when it should sound, on this page's performance.now()
//   // every other page in 'class4' gets onMessages([{ bytes: [0x90, 60, 100], at: <its own performance.now()> }])
//
// Two sockets a page, so it works with the relay as deployed (hub.js routes controller → runner): one `controller`
// that sends, one `runner` that hears. A page hears its own sends on its runner too; they carry its id and are dropped.
//
// Time. Two computers' clocks disagree (by milliseconds to seconds), and each message spends 30–150 ms on the way.
// Strudel hands its MIDI over 0.2–0.3 s before it should sound, with that moment as a timestamp; the link keeps it:
// each message says when it left (`at`, the sender's clock) and when each item should sound (`t`, same clock).
//   offset  = (arrival on my clock) − at: the clock difference plus this trip's latency. Its minimum over the last
//             10 s is the clock difference plus the fastest trip — a jittery network only ever makes it larger.
//   trip    = the fastest trip, estimated from both ends' ping round trips to the relay ((rtt sender + rtt receiver) / 2),
//             each the smallest of its last 30 s: a page busy drawing answers a ping late (measured on strudel.cc: one
//             round trip of 154 ms on a 60-ms line made a linked page play 48 ms early until the minimum was used).
//   play at = t + (offset_min − trip) + delay   (on my clock), or at once if that is already past ("late").
// So an item sounds here when it sounds there (give or take the asymmetry of the two halves of a round trip: a few ms
// on one machine, ~10 ms across a city), as long as the sender's lead (Strudel: 200 ms) is longer than the trip; jitter
// below the lead never shows. A program that sends with no lead arrives late by the trip and plays on arrival.
// `delay` (ms) adds a fixed buffer on top, for a network whose jitter is larger than the lead.
//
// Loops: what a page received is never sent on by the link (oav-p5 sends only what its own programs played into the
// virtual output); every message has a sequence number, and one seen twice is dropped.

import { RelayClient } from './index.js?v=a4419ca';

export const LINK_SIGNAL = 'oav/link';
const rnd = () => Math.random().toString(36).slice(2, 8);
const epochNow = () => (typeof performance !== 'undefined' && performance.timeOrigin ? performance.timeOrigin + performance.now() : Date.now());

/** The clock difference to one sender, from the messages' departure times (pure, testable). */
export class LinkTiming {
  constructor({ window = 10000 } = {}) { this.window = window; this.samples = []; this.min = null; }
  /** a message that left at `at` (sender's clock) arrived at `recv` (mine) */
  sample(at, recv) {
    const o = recv - at, s = this.samples;
    s.push({ o, recv });
    while (s.length > 1 && recv - s[0].recv > this.window) s.shift();
    if (s.length > 400) s.splice(0, s.length - 400);
    let m = Infinity; for (const x of s) if (x.o < m) m = x.o;
    this.min = m;
    return o;
  }
  /** my clock minus the sender's, as well as it can be told (null before the first message) */
  diff(trip = 0) { return this.min == null ? null : this.min - trip; }
}

export class MidiLink {
  /**
   * @param {object} o
   * @param {string} o.url        the relay (wss://…/relay); role / room / id are added here
   * @param {string} o.room
   * @param {number} [o.delay]    ms of extra buffer (default 0)
   * @param {(list:{bytes:number[], at:number, late:boolean}[], from:string)=>void} o.onMessages   `at` on this page's
   *                              performance.now() (ms) — or on the clock `now()` returns, minus `origin`
   * @param {(s:object)=>void} [o.onStatus]
   * @param {()=>number} [o.now]  this page's clock in epoch ms (default performance.timeOrigin + performance.now())
   * @param {number} [o.origin]   what to subtract from that clock to give `at` (default performance.timeOrigin)
   */
  constructor({ url, room, id = 'l-' + rnd(), delay = 0, onMessages = null, onStatus = null, now = epochNow, origin = null, Client = RelayClient, beaconMs = 2000 } = {}) {
    Object.assign(this, { url, room, id, delay: +delay || 0, onMessages, onStatus, now, Client, beaconMs });
    this.origin = origin != null ? origin : (typeof performance !== 'undefined' && performance.timeOrigin ? performance.timeOrigin : 0);
    this.seq = 0; this.pending = []; this._flushing = false; this.tx = null; this.rx = null; this._beat = null;
    this.peers = new Map();                                 // src → { seen (my epoch ms), timing, trip }
    this.stats = { sent: 0, msgs: 0, received: 0, late: 0, dupes: 0, lead: null, trip: null, diff: null };
    this._seen = new Map();                                 // src → Set of recent seq
    this._rtts = { tx: [], rx: [] };
  }
  // the smallest round trip of the last 30 s on one socket (null before the first pong)
  _rtt(k) {
    const c = this[k], a = this._rtts[k], t = this.now();
    if (c && c.latency != null && (!a.length || a[a.length - 1].v !== c.latency || t - a[a.length - 1].t > 1000)) a.push({ t, v: c.latency });
    while (a.length > 1 && t - a[0].t > 30000) a.shift();
    let m = null; for (const x of a) if (m == null || x.v < m) m = x.v;
    return m;
  }
  _wsUrl(role) {
    const u = this.url || '';
    return u + (u.includes('?') ? '&' : '?') + `role=${role}&room=${encodeURIComponent(this.room)}&id=${encodeURIComponent(this.id + '-' + role[0])}`;
  }
  connect() {
    const status = () => { this._rtt('tx'); this._rtt('rx'); this._status(); };
    this.tx = new this.Client({ role: 'controller', room: this.room, id: this.id, url: this._wsUrl('controller'), onStatus: status });
    this.rx = new this.Client({ role: 'runner', room: this.room, id: this.id, url: this._wsUrl('runner'), onStatus: status,
      onSignal: (name, value) => { if (name === LINK_SIGNAL) this._receive(value); } });
    this.tx.connect(); this.rx.connect();
    if (this.beaconMs > 0) this._beat = setInterval(() => this._flush(true), this.beaconMs);   // "I am here", with my round trip
    return this;
  }
  close() { clearInterval(this._beat); this._beat = null; this.tx?.close(); this.rx?.close(); }
  get open() { return !!(this.tx?.open && this.rx?.open); }

  /** one MIDI message to every other page in the room, to sound at `whenMs` (this page's performance.now(); default now) */
  send(bytes, whenMs) {
    const t = whenMs == null ? this.now() : this.origin + whenMs;
    this.pending.push([Math.round(t * 100) / 100, ...Array.from(bytes, (b) => b & 0xFF)]);
    if (!this._flushing) {                                  // everything one program sends in one go travels as one message
      this._flushing = true;
      const go = () => { this._flushing = false; this._flush(false); };
      if (typeof queueMicrotask === 'function') queueMicrotask(go); else Promise.resolve().then(go);
    }
  }
  _flush(beacon) {
    if (!beacon && !this.pending.length) return;
    const items = beacon ? [] : this.pending.splice(0);
    if (!this.tx?.open) return;                             // nobody to hear it: dropped (a late note is worse than none)
    this.tx.send(LINK_SIGNAL, { v: 1, src: this.id, seq: ++this.seq, at: Math.round(this.now() * 100) / 100, rtt: this._rtt('tx'), items }, true);
    if (items.length) { this.stats.sent += items.length; this.stats.msgs++; }
  }
  _receive(v) {
    if (!v || v.v !== 1 || typeof v.src !== 'string' || v.src === this.id) return;
    const recv = this.now();
    let seen = this._seen.get(v.src);
    if (!seen) { seen = new Set(); this._seen.set(v.src, seen); }
    if (seen.has(v.seq)) { this.stats.dupes++; return; }
    seen.add(v.seq);
    if (seen.size > 512) seen.delete(seen.values().next().value);
    let p = this.peers.get(v.src);
    if (!p) { p = { seen: recv, timing: new LinkTiming(), trip: 0 }; this.peers.set(v.src, p); }
    p.seen = recv;
    if (typeof v.at === 'number') p.timing.sample(v.at, recv);
    const rr = this._rtt('rx'), rs = typeof v.rtt === 'number' ? v.rtt : null;
    p.trip = ((rs ?? rr ?? 0) + (rr ?? rs ?? 0)) / 2;
    const diff = p.timing.diff(p.trip);
    this.stats.trip = Math.round(p.trip); this.stats.diff = diff == null ? null : Math.round(diff);
    const items = Array.isArray(v.items) ? v.items : [];
    if (!items.length) { this._status(); return; }
    const out = [];
    let lead = 0;
    for (const it of items) {
      if (!Array.isArray(it) || it.length < 2) continue;
      const t = +it[0], bytes = it.slice(1).map((b) => b & 0xFF);
      let at = (isFinite(t) && diff != null ? t + diff : recv) + this.delay;
      const late = at < recv;
      if (late) { at = recv; this.stats.late++; }
      lead += at - recv;
      out.push({ bytes, at: at - this.origin, late });
    }
    this.stats.received += out.length;
    if (out.length) this.stats.lead = Math.round(lead / out.length);
    this._status();
    if (out.length && this.onMessages) this.onMessages(out, v.src);
  }
  /** the other pages heard in the last 6 s */
  peerCount() { const t = this.now(); let n = 0; for (const p of this.peers.values()) if (t - p.seen < 6000) n++; return n; }
  info() {
    return { room: this.room, id: this.id, state: this.open ? 'open' : (this.tx?.status === 'closed' || this.rx?.status === 'closed') ? 'closed' : 'connecting',
      peers: this.peerCount(), rtt: this._rtt('rx'), ...this.stats };
  }
  _status() { this.onStatus?.(this.info()); }
}
