// @openav/leap — Leap Motion / Ultraleap hands → signals.
//
// The sensor is read by a small local bridge (packages/leap/bridge/leap-bridge.mjs, one per
// machine, ws://127.0.0.1:6437) because browsers cannot talk to LeapC. LeapInput connects to it
// (or to any service that still speaks the LeapJS v6 protocol), and publishes NORMALIZED signals
// — the L1 contract: it never touches params or worlds.
//
//   leap/status                         0 no bridge · 1 bridge, no tracking service · 2 service, no device · 3 tracking
//   leap/hands                          0..2 hands in view
//   leap/hand/<left|right>/present      0|1
//   leap/hand/<side>/x .y .z            0..1 palm in the interaction box (x right, y up, z toward the player)
//   leap/hand/<side>/pinch .grab        0..1 strengths (0 when the hand is lost — a lost hand lets go)
//   leap/hand/<side>/roll .pitch .yaw   -π..π radians (LeapJS conventions)
//   leap/hand/<side>/speed              0..1 palm speed, 1 = 1 m/s
//   leap/hand/<side>/<finger>/x .y .z   0..1 fingertips (thumb index middle ring pinky)
//   leap/both/distance                  0..1 palm-to-palm distance, 1 = 40 cm (both hands in view)
//   pulses  leap/hand/<side>/pinch-start|pinch-end   pinch > 0.86 starts, < 0.5 ends
//           leap/hand/<side>/grab-start|grab-end     grab > 0.8 starts, < 0.5 ends
//           leap/both/pinch-start|pinch-end          both > 0.8 enters, either < 0.5 exits
//           payload { side, x, y, z, strength } (both: { x, y, z, distance } at the midpoint)
//
// Worlds that want joints read leap.hands (palm, 5 × 5 finger joints, arm, in mm) or the latest
// message as it came, leap.frame. Continuous control should still reach a world through params
// (map leap/hand/right/y → a param); the joints are for drawing the hand itself.

import { FINGERS, INTERACTION_BOX, V6Converter, handsOf, handAngles, normalizePoint, handBones } from './frame.js?v=0cfcfd4';
import { HandGestures, THRESHOLDS } from './gesture.js?v=0cfcfd4';
import { mockHand } from './mock.js?v=0cfcfd4';
import { mountLeapPanel } from './panel.js?v=0cfcfd4';

export { FINGERS, INTERACTION_BOX, PROTOCOL_VERSION, V6Converter, rawToV6, handsOf, handAngles, normalizePoint, handBones, boneBasis, palmBasis, v6Header, deviceEvent, protocolOfPath } from './frame.js?v=0cfcfd4';
export { Hysteresis, HandGestures, THRESHOLDS } from './gesture.js?v=0cfcfd4';
export { mockHand, mockFrame } from './mock.js?v=0cfcfd4';
export { mountLeapPanel } from './panel.js?v=0cfcfd4';

export const DEFAULT_URL = 'ws://127.0.0.1:6437/v6.json';
export const STATUS = Object.freeze({ off: 0, bridge: 1, service: 2, tracking: 3 });
const SIDES = ['left', 'right'];
const SPEED_FULL = 1000;     // mm/s that reads as speed 1
const BOTH_FULL = 400;       // mm palm-to-palm that reads as distance 1

/** Every signal LeapInput publishes, with its declaration — tests and docs read this list. */
export function leapSignals({ fingers = true } = {}) {
  const out = [
    ['leap/status', { min: 0, max: 3, description: '0 no bridge · 1 bridge · 2 service, no device · 3 tracking' }],
    ['leap/hands', { min: 0, max: 2, description: 'hands in view' }],
    ['leap/both/distance', { min: 0, max: 1, description: 'palm-to-palm distance, 1 = 40 cm' }],
    ['leap/both/pinch-start', { kind: 'pulse' }],
    ['leap/both/pinch-end', { kind: 'pulse' }],
  ];
  for (const s of SIDES) {
    const p = `leap/hand/${s}`;
    out.push([`${p}/present`, { min: 0, max: 1 }]);
    for (const a of ['x', 'y', 'z']) out.push([`${p}/${a}`, { min: 0, max: 1 }]);
    out.push([`${p}/pinch`, { min: 0, max: 1 }], [`${p}/grab`, { min: 0, max: 1 }]);
    for (const a of ['roll', 'pitch', 'yaw']) out.push([`${p}/${a}`, { min: -Math.PI, max: Math.PI, unit: 'rad' }]);
    out.push([`${p}/speed`, { min: 0, max: 1, description: 'palm speed, 1 = 1 m/s' }]);
    if (fingers) for (const f of FINGERS) for (const a of ['x', 'y', 'z']) out.push([`${p}/${f}/${a}`, { min: 0, max: 1 }]);
    for (const e of ['pinch-start', 'pinch-end', 'grab-start', 'grab-end']) out.push([`${p}/${e}`, { kind: 'pulse' }]);
  }
  return out.map(([name, meta]) => [name, { source: 'leap', ...meta }]);
}

export class LeapInput {
  /**
   * @param {object} [o]
   * @param {import('../core/src/signals.js?v=0cfcfd4').Signals} [o.signals]
   * @param {string}  [o.url]           bridge URL: ws://127.0.0.1:6437/v6.json (default) or …/raw
   * @param {boolean} [o.reconnect=true]
   * @param {boolean} [o.fingers=true]  publish fingertip signals (15 per hand)
   * @param {object}  [o.box]           interaction box {center, size} in mm (default: the classic Leap box)
   * @param {object}  [o.thresholds]    gesture hysteresis override ({pinch:{on,off}, bothPinch, grab})
   * @param {Function} [o.WebSocket]    constructor (default: globalThis.WebSocket — also Node 22's)
   */
  constructor({ signals = null, url = DEFAULT_URL, reconnect = true, fingers = true, box = INTERACTION_BOX, thresholds = THRESHOLDS, WebSocket: WS = null } = {}) {
    this.signals = signals;
    this.url = url;
    this.reconnect = reconnect;
    this.fingers = fingers;
    this.box = box;
    this.WS = WS;
    this.status = 'idle';          // idle · connecting · bridge · no-service · no-device · tracking · simulated · closed
    this.frame = null;             // latest message as it came (v6 frame, or raw on /raw)
    this.hands = [];               // [hand] — see frame.js for the shape
    this.device = null;
    this.serviceVersion = null;
    this.fps = 0;
    this.frames = 0;
    this.gestures = new HandGestures(thresholds);
    this._present = { left: false, right: false };
    this._count = -1;
    this._subs = { frame: new Set(), status: new Set() };
    this._ws = null; this._retry = 500; this._timer = null; this._wanted = false;
    this._sim = null; this._held = null;
    this._conv = new V6Converter({ box });
    if (signals) for (const [name, meta] of leapSignals({ fingers })) signals.define(name, meta);
    this._setStatus('idle');
  }

  /** Open the bridge connection (reconnects with back-off until disconnect()). */
  connect() {
    this._wanted = true;
    this._open();
    return this;
  }

  disconnect() {
    this._wanted = false;
    clearTimeout(this._timer);
    const ws = this._ws; this._ws = null;
    if (ws) { try { ws.onclose = ws.onerror = ws.onmessage = null; ws.close(); } catch {} }
    this._setStatus('closed');
    if (!this._sim) this._lose();
  }

  get connected() { return !!this._ws && this._ws.readyState === 1; }

  /** The hand on one side, or null. */
  hand(side) { return this.hands.find((h) => h.side === side) || null; }

  /** mm → 0..1 in this input's interaction box. */
  normalize(p, clamp = true) { return normalizePoint(p, this.box, clamp); }

  onFrame(cb) { this._subs.frame.add(cb); return () => this._subs.frame.delete(cb); }
  onStatus(cb) { this._subs.status.add(cb); return () => this._subs.status.delete(cb); }

  /**
   * Feed one parsed message (what the socket would deliver): a v6 header, a v6 frame, a device
   * event, or a raw status / frame line. Public so tests, recordings and the simulator share the
   * exact path real frames take.
   */
  ingest(msg) {
    if (!msg || typeof msg !== 'object') return;
    if (msg.version != null && msg.serviceVersion != null && !msg.hands) {   // v6 header
      this.serviceVersion = msg.serviceVersion;
      this._setStatus('bridge');
      return;
    }
    if (msg.event) {
      const st = msg.event.state || {};
      if (msg.event.type === 'deviceEvent') {
        this.device = st.attached ? st.id : null;
        this._setStatus(st.service === false ? 'no-service' : st.streaming ? 'tracking' : 'no-device');
      }
      return;
    }
    if (msg.t === 'status') {
      this.device = msg.device || null;
      this._setStatus(msg.service === false ? 'no-service' : msg.device ? 'tracking' : 'no-device');
      return;
    }
    if (msg.t === 'info') { this.serviceVersion = msg.server || this.serviceVersion; return; }
    if (!Array.isArray(msg.hands)) return;
    this.frame = msg;
    this.frames++;
    this.fps = msg.currentFrameRate ?? msg.fps ?? this.fps;
    if (!this._sim && this.status !== 'tracking') this._setStatus('tracking');
    this.hands = handsOf(msg);
    this._publish(this.hands);
    for (const cb of this._subs.frame) { try { cb(msg, this.hands); } catch (e) { console.error('[leap] onFrame:', e); } }
  }

  // ------------------------------------------------------------ simulator (no hardware)
  /**
   * Mouse / touch become hands, through the same path as the sensor. Opt-in.
   *   move = right palm (x across, y up the screen) · wheel = depth · press = pinch ·
   *   right button or Alt+press = grab · hold Shift = drive the left hand · a second finger = left hand.
   * Returns stop().
   */
  simulate({ target = typeof window !== 'undefined' ? window : null, hz = 60 } = {}) {
    if (this._sim) return this._sim.stop;
    if (!target) throw new Error('LeapInput.simulate: no target to listen on');
    const box = this.box;
    const mm = (u, i) => (u - 0.5) * box.size[i] + box.center[i];
    const hand = () => ({ on: false, x: 0.5, y: 0.5, z: 0.5, pinch: 0, grab: 0, wantPinch: 0, wantGrab: 0 });
    const S = { right: hand(), left: hand(), id: 0 };
    const rect = () => (target.getBoundingClientRect ? target.getBoundingClientRect() : { left: 0, top: 0, width: innerWidth, height: innerHeight });
    const place = (h, e) => { const r = rect(); h.x = (e.clientX - r.left) / (r.width || 1); h.y = 1 - (e.clientY - r.top) / (r.height || 1); };
    const pick = (e) => (e.shiftKey || (e.pointerType === 'touch' && !e.isPrimary) ? S.left : S.right);
    const down = (e) => { const h = pick(e); h.on = true; place(h, e); if (e.button === 2 || e.altKey) h.wantGrab = 1; else h.wantPinch = 1; };
    const move = (e) => { const h = pick(e); if (e.pointerType !== 'touch') h.on = true; place(h, e); };
    const up = (e) => { const h = pick(e); h.wantPinch = 0; h.wantGrab = 0; if (e.pointerType === 'touch') h.on = false; };
    const leave = (e) => { if (e.pointerType !== 'touch') S.right.on = S.left.on = false; };
    const wheel = (e) => { const h = e.shiftKey ? S.left : S.right; h.z = Math.min(1, Math.max(0, h.z + Math.sign(e.deltaY) * 0.04)); };
    const menu = (e) => e.preventDefault();
    const ev = [['pointerdown', down], ['pointermove', move], ['pointerup', up], ['pointercancel', up], ['pointerleave', leave], ['wheel', wheel], ['contextmenu', menu]];
    for (const [n, f] of ev) target.addEventListener(n, f, { passive: n !== 'contextmenu' });
    const step = 1 / hz;
    const timer = setInterval(() => {
      const hands = [];
      for (const [side, h, id] of [['R', S.right, 1], ['L', S.left, 2]]) {
        h.pinch += Math.max(-step * 6, Math.min(step * 6, h.wantPinch - h.pinch));   // ~0.17 s to close, like a real pinch
        h.grab += Math.max(-step * 4, Math.min(step * 4, h.wantGrab - h.grab));
        if (h.on) hands.push(mockHand({ id, side, palm: [mm(h.x, 0), mm(h.y, 1), mm(h.z, 2)], pinch: h.pinch, grab: h.grab }));
      }
      const raw = { t: 'f', id: ++S.id, fps: hz, hands };
      this.ingest(/\/raw\b/.test(this.url) ? raw : this._conv.convert(raw));
    }, 1000 / hz);
    const stop = () => {
      clearInterval(timer);
      for (const [n, f] of ev) target.removeEventListener(n, f);
      this._sim = null;
      this._lose();
      this._setStatus(this._held || (this.connected ? 'bridge' : this._wanted ? 'connecting' : 'idle'));
      this._held = null;
    };
    this._held = this.status;          // what the bridge says keeps updating underneath (see _setStatus)
    this._sim = { stop };
    this._setStatus('simulated');
    return stop;
  }

  get simulating() { return !!this._sim; }

  /** Stop the simulator (the bridge's hands come back if it is connected). */
  stopSimulation() { if (this._sim) this._sim.stop(); }

  // ------------------------------------------------------------ drawing
  /**
   * A point in mm → canvas pixels. view:
   *   'oblique' (default) the performer's eye: up the canvas = higher AND farther, so a flat hand
   *             shows its fingers instead of a line
   *   'front'   x across, y up (a palm-down hand is edge-on)
   *   'top'     x across, z down the canvas toward the performer
   * Uses this input's interaction box (so drawings line up with the leap/* signals) unless `box` is given.
   */
  project(p, w, h, { view = 'oblique', box = this.box } = {}) {
    const n = normalizePoint(p, box, false);
    if (view === 'top') return [n[0] * w, n[2] * h];
    if (view === 'front') return [n[0] * w, (1 - n[1]) * h];
    return [n[0] * w, (0.65 * (1 - n[1]) + 0.35 * n[2]) * h];
  }

  /** Draw the hands onto a 2D context (see project() for views). Points outside the box still draw. */
  skeleton(ctx, w, h, { view = 'oblique', box = this.box, colorLeft = 'rgba(55,201,120,0.95)', colorRight = 'rgba(255,209,102,0.95)', lineWidth = 2, hands = this.hands } = {}) {
    const P = (p) => this.project(p, w, h, { view, box });
    for (const hand of hands) {
      const col = hand.side === 'left' ? colorLeft : colorRight;
      ctx.strokeStyle = col; ctx.fillStyle = col; ctx.lineWidth = lineWidth;
      for (const [a, b] of handBones(hand)) {
        if (!a || !b) continue;
        const [x1, y1] = P(a), [x2, y2] = P(b);
        ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
      }
      const [px, py] = P(hand.palm);
      ctx.globalAlpha = 0.25 + hand.grab * 0.5;
      ctx.beginPath(); ctx.arc(px, py, Math.max(3, lineWidth * 3), 0, 6.2832); ctx.fill();
      ctx.globalAlpha = 1;
      for (const f of hand.fingers) {
        const tip = f[f.length - 1]; if (!tip) continue;
        const [x, y] = P(tip);
        ctx.beginPath(); ctx.arc(x, y, lineWidth * 1.6, 0, 6.2832); ctx.fill();
      }
      if (hand.pinch > THRESHOLDS.pinch.off && hand.fingers[0]?.length && hand.fingers[1]?.length) {
        const [x, y] = P(hand.fingers[1][hand.fingers[1].length - 1]);
        ctx.globalAlpha = Math.min(1, hand.pinch);
        ctx.beginPath(); ctx.arc(x, y, lineWidth * 4, 0, 6.2832); ctx.stroke();
        ctx.globalAlpha = 1;
      }
    }
  }

  /** A small status + skeleton panel (the console's L1 section uses it; so does the lab). */
  mountPanel(el, opts) { return mountLeapPanel(el, this, opts); }

  // ------------------------------------------------------------ internals
  _open() {
    if (!this._wanted || this._ws) return;
    const WS = this.WS || globalThis.WebSocket;
    if (!WS) { this._setStatus('closed'); return; }
    let ws;
    try { ws = new WS(this.url); } catch (e) { this._schedule(); return; }
    this._ws = ws;
    this._setStatus('connecting');
    ws.onopen = () => {
      this._retry = 500;
      // what LeapJS says on open; our bridge ignores it, an old Leap service streams only after it
      try { ws.send(JSON.stringify({ background: true })); ws.send(JSON.stringify({ focused: true })); } catch {}
    };
    ws.onmessage = (m) => {
      let msg; try { msg = JSON.parse(typeof m.data === 'string' ? m.data : String(m.data)); } catch { return; }
      if (this._sim && Array.isArray(msg.hands)) return;      // the simulator owns the hands while it runs
      this.ingest(msg);
    };
    ws.onerror = () => {};
    ws.onclose = () => {
      if (this._ws !== ws) return;
      this._ws = null;
      this._setStatus(this._wanted ? 'connecting' : 'closed');
      if (!this._sim) this._lose();
      this._schedule();
    };
  }

  _schedule() {
    if (!this._wanted || !this.reconnect) return;
    clearTimeout(this._timer);
    this._timer = setTimeout(() => this._open(), this._retry);
    this._retry = Math.min(5000, this._retry * 2);
  }

  _setStatus(s) {
    if (this._sim && s !== 'simulated') { this._held = s; return; }   // restored when the simulator stops
    const changed = s !== this.status;
    this.status = s;
    const code = s === 'tracking' || s === 'simulated' ? 3 : s === 'no-device' ? 2 : s === 'bridge' || s === 'no-service' ? 1 : 0;
    if (this.signals && this.signals.get('leap/status') !== code) this.signals.set('leap/status', code);
    if (changed) for (const cb of this._subs.status) { try { cb(s, this); } catch (e) { console.error('[leap] onStatus:', e); } }
  }

  /** Every hand let go (connection lost, simulator stopped). */
  _lose() {
    if (!this.hands.length && this._count === 0) return;
    this.hands = [];
    this._publish([]);
  }

  _publish(hands) {
    const s = this.signals;
    const events = this.gestures.update(hands);
    if (!s) return;
    if (hands.length !== this._count) { this._count = hands.length; s.set('leap/hands', hands.length); }
    const by = {};
    for (const h of hands) if (!by[h.side]) by[h.side] = h;
    for (const side of SIDES) {
      const h = by[side], p = `leap/hand/${side}`;
      if (!h) {
        if (this._present[side]) {
          this._present[side] = false;
          s.set(`${p}/present`, 0); s.set(`${p}/pinch`, 0); s.set(`${p}/grab`, 0); s.set(`${p}/speed`, 0);
        }
        continue;
      }
      if (!this._present[side]) { this._present[side] = true; s.set(`${p}/present`, 1); }
      const n = normalizePoint(h.palm, this.box);
      s.set(`${p}/x`, n[0]); s.set(`${p}/y`, n[1]); s.set(`${p}/z`, n[2]);
      s.set(`${p}/pinch`, h.pinch); s.set(`${p}/grab`, h.grab);
      const a = handAngles(h.direction, h.normal);
      s.set(`${p}/roll`, a.roll); s.set(`${p}/pitch`, a.pitch); s.set(`${p}/yaw`, a.yaw);
      s.set(`${p}/speed`, Math.min(1, Math.hypot(h.velocity[0], h.velocity[1], h.velocity[2]) / SPEED_FULL));
      if (this.fingers) {
        for (let d = 0; d < 5; d++) {
          const f = h.fingers[d]; const tip = f && f[f.length - 1]; if (!tip) continue;
          const t = normalizePoint(tip, this.box);
          const q = `${p}/${FINGERS[d]}`;
          s.set(`${q}/x`, t[0]); s.set(`${q}/y`, t[1]); s.set(`${q}/z`, t[2]);
        }
      }
    }
    if (by.left && by.right) {
      const d = Math.hypot(by.left.palm[0] - by.right.palm[0], by.left.palm[1] - by.right.palm[1], by.left.palm[2] - by.right.palm[2]);
      s.set('leap/both/distance', Math.min(1, d / BOTH_FULL));
    }
    for (const e of events) {
      if (e.side === 'both') {
        const [l, r] = e.hands || [];
        const mid = l && r ? normalizePoint([(l.palm[0] + r.palm[0]) / 2, (l.palm[1] + r.palm[1]) / 2, (l.palm[2] + r.palm[2]) / 2], this.box) : [0.5, 0.5, 0.5];
        s.pulse(`leap/${e.type.replace('both-', 'both/')}`, { x: mid[0], y: mid[1], z: mid[2], distance: s.get('leap/both/distance') ?? 0 });
      } else {
        const n = e.hand ? normalizePoint(e.hand.palm, this.box) : [s.get(`leap/hand/${e.side}/x`) ?? 0.5, s.get(`leap/hand/${e.side}/y`) ?? 0.5, s.get(`leap/hand/${e.side}/z`) ?? 0.5];
        const strength = e.hand ? e.hand[e.type.startsWith('pinch') ? 'pinch' : 'grab'] : 0;
        s.pulse(`leap/hand/${e.side}/${e.type}`, { side: e.side, x: n[0], y: n[1], z: n[2], strength });
      }
    }
  }
}
