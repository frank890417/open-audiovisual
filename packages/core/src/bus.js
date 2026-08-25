// Bus — minimal typed event emitter. No wildcards, no async magic.
export class Bus {
  constructor() { this._subs = new Map(); }

  /** Subscribe. Returns an unsubscribe function. */
  on(event, cb) {
    if (!this._subs.has(event)) this._subs.set(event, new Set());
    this._subs.get(event).add(cb);
    return () => this.off(event, cb);
  }

  off(event, cb) { this._subs.get(event)?.delete(cb); }

  emit(event, payload) {
    const set = this._subs.get(event);
    if (!set) return;
    for (const cb of set) { try { cb(payload); } catch (e) { console.error(`[bus] ${event} handler:`, e); } }
  }
}
