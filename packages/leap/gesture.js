// @openav/leap · gesture — pinch / grab as clean start/end events.
//
// A pinch strength hovers around any single threshold while the fingers are "almost touching",
// and a single threshold then fires start/end/start/end at 60 Hz — a seed planted five times.
// So every gesture is a Schmitt trigger: it starts above `on` and only ends below `off`.
// The numbers are The Last Input's, tuned on the Leap Motion Controller 2 (2026-10-05) and
// adopted here so one bridge means one feel:
//   single-hand pinch   starts > 0.86, releases < 0.5
//   both-hands pinch    enters > 0.8 (both),   exits < 0.5 (either) — or when a hand is lost
//   grab (fist)         starts > 0.8,  releases < 0.5
// A hand that disappears mid-gesture always ends it (a lost hand must not stay pinched).

export const THRESHOLDS = Object.freeze({
  pinch: Object.freeze({ on: 0.86, off: 0.5 }),
  bothPinch: Object.freeze({ on: 0.8, off: 0.5 }),
  grab: Object.freeze({ on: 0.8, off: 0.5 }),
});

/** One Schmitt trigger. update(v) → 'start' | 'end' | null. */
export class Hysteresis {
  constructor(on, off) {
    if (!(off < on)) throw new Error('Hysteresis: off must be below on');
    this.on = on; this.off = off; this.active = false;
  }
  update(v) {
    if (!this.active && v > this.on) { this.active = true; return 'start'; }
    if (this.active && (v == null || Number.isNaN(v) || v < this.off)) { this.active = false; return 'end'; }
    return null;
  }
  /** Force the end (hand lost). Returns 'end' only if it was active. */
  release() { if (!this.active) return null; this.active = false; return 'end'; }
}

/**
 * Per-side pinch and grab plus the two-hand pinch.
 * update(hands) takes [{side:'left'|'right', pinch, grab, …}] and returns events in a stable
 * order: [{type:'pinch-start'|'pinch-end'|'grab-start'|'grab-end', side, hand}, {type:'both-pinch-start'|…}].
 */
export class HandGestures {
  constructor(thresholds = THRESHOLDS) {
    const t = { ...THRESHOLDS, ...thresholds };
    this.t = t;
    this.side = {};
    for (const s of ['left', 'right']) this.side[s] = { pinch: new Hysteresis(t.pinch.on, t.pinch.off), grab: new Hysteresis(t.grab.on, t.grab.off) };
    this.both = new Hysteresis(t.bothPinch.on, t.bothPinch.off);
  }

  update(hands) {
    const out = [];
    const by = { left: null, right: null };
    for (const h of hands || []) if (h && (h.side === 'left' || h.side === 'right') && !by[h.side]) by[h.side] = h;
    for (const s of ['left', 'right']) {
      const h = by[s], g = this.side[s];
      for (const kind of ['pinch', 'grab']) {
        const e = h ? g[kind].update(h[kind]) : g[kind].release();
        if (e) out.push({ type: `${kind}-${e}`, side: s, hand: h });
      }
    }
    // both hands: the weaker of the two pinches decides (entering needs both, leaving needs either)
    const both = by.left && by.right ? Math.min(by.left.pinch, by.right.pinch) : null;
    const e = both == null ? this.both.release() : this.both.update(both);
    if (e) out.push({ type: `both-pinch-${e}`, side: 'both', hand: null, hands: [by.left, by.right] });
    return out;
  }

  /** What is held right now: { left: {pinch, grab}, right: {…}, both } */
  get state() {
    return {
      left: { pinch: this.side.left.pinch.active, grab: this.side.left.grab.active },
      right: { pinch: this.side.right.pinch.active, grab: this.side.right.grab.active },
      both: this.both.active,
    };
  }
}
