// @openav/leap · frame — the two wire formats and the one hand shape everything else reads.
//
// Pure functions, no DOM, no Node built-ins: the bridge (Node) converts with them, LeapInput
// (browser) reads with them, the tests check them. Units are millimetres in Ultraleap's
// Desktop frame (sensor facing up): +x right, +y up, +z toward the player.
//
// raw  — The Last Input's line format (leap-stream.c), served verbatim on ws://…:6437/raw:
//   {"t":"f","id","fps","hands":[{"id","side":"L"|"R","conf","pinch","grab","palm","vel","n","dir","w",
//     "f":[5 fingers thumb→pinky × 5 points: metacarpal start, metacarpal end, proximal end, intermediate end, tip],
//     "ext":[5 × 0/1],"arm":[[elbow],[wrist]]}]}
// v6   — the LeapJS 0.6.x / 1.x WebSocket protocol (ws://127.0.0.1:6437/v6.json) that every
//   2014–2021 Leap browser sketch speaks: a header {serviceVersion, version}, then frames with
//   hands[] and pointables[] (the fields LeapJS's Frame/Hand/Pointable/Finger/Bone constructors
//   read — checked against leapjs 0.6.1, 0.6.4 and 1.1.1). LeapC gives joints, not bone
//   rotations, so bases are rebuilt from the joints and the palm normal; stabilized positions
//   are a light low-pass; tipVelocity is a finite difference.
// hand — what LeapInput publishes from and hands to worlds (either format in, same shape out):
//   { id, side: 'left'|'right', confidence, pinch, grab, palm, velocity, normal, direction,
//     width, fingers: [5 × 5 points], extended: [5 booleans], elbow, wrist, timeVisible }

export const FINGERS = ['thumb', 'index', 'middle', 'ring', 'pinky'];

/** The classic Leap interaction box (v2 service defaults). normalizePoint() maps it to 0..1. */
export const INTERACTION_BOX = Object.freeze({ center: [0, 200, 0], size: [235.247, 235.247, 147.751] });

/** Highest LeapJS protocol we speak: LeapJS ≤ 1.1.1 throws "unrecognized version" above 6. */
export const PROTOCOL_VERSION = 6;

// ---------------------------------------------------------------- small vector kit
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const mul = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const len = (a) => Math.hypot(a[0], a[1], a[2]);
const unit = (a, fallback = [0, 0, -1]) => { const l = len(a); return l > 1e-9 ? [a[0] / l, a[1] / l, a[2] / l] : fallback.slice(); };
const r1 = (v) => Math.round(v * 10) / 10 + 0;      // + 0: no -0 on the wire
const r3 = (v) => Math.round(v * 1000) / 1000 + 0;
const rv = (a, f = r1) => [f(a[0]), f(a[1]), f(a[2])];
export const vec = { sub, add, mul, dot, cross, len, unit };

/**
 * An orthonormal bone basis [x, y, z] the way Leap defines it: z runs from the bone's tip back
 * to its base (Bone.direction() = -z), y is the back of the hand (-palm normal, made
 * perpendicular to z), x = y × z — negated for a left hand, so det < 0 and LeapJS's
 * Bone._left is true for left hands exactly as with the real service.
 */
export function boneBasis(prev, next, palmNormal, left) {
  const z = unit(sub(prev, next), [0, 0, 1]);
  const perp = (v) => sub(v, mul(z, dot(v, z)));
  let y = perp(mul(palmNormal, -1));
  if (len(y) < 1e-6) y = perp(Math.abs(z[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0]);   // bone parallel to the normal
  y = unit(y, [0, 1, 0]);
  let x = cross(y, z);
  if (left) x = mul(x, -1);
  return [rv(x, r3), rv(y, r3), rv(z, r3)];
}

/** The palm's basis (Leap: x = sideways, y = back of the hand, z = toward the wrist), rows like boneBasis. */
export function palmBasis(direction, normal, left) {
  const z = unit(mul(direction, -1), [0, 0, 1]);
  const y = unit(sub(mul(normal, -1), mul(z, dot(mul(normal, -1), z))), [0, 1, 0]);
  let x = cross(y, z);
  if (left) x = mul(x, -1);
  return [rv(x, r3), rv(y, r3), rv(z, r3)];
}

/** LeapJS angles: pitch/yaw from the hand direction, roll from the palm normal (radians, -π..π). */
export function handAngles(direction, normal) {
  return {
    pitch: Math.atan2(direction[1], -direction[2]),
    yaw: Math.atan2(direction[0], -direction[2]),
    roll: Math.atan2(normal[0], -normal[1]),
  };
}

/** Interaction-box normalization (LeapJS InteractionBox.normalizePoint), clamped to 0..1 by default. */
export function normalizePoint(p, box = INTERACTION_BOX, clamp = true) {
  const out = [0, 1, 2].map((i) => (p[i] - box.center[i]) / box.size[i] + 0.5);
  return clamp ? out.map((v) => Math.min(1, Math.max(0, v))) : out;
}

// finger widths relative to the palm width (LeapC gives per-bone widths; the raw line does not)
const WIDTH = [0.235, 0.21, 0.205, 0.195, 0.18];
const IDENTITY = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];

/**
 * Raw (TLI) → LeapJS v6. Stateful only where the protocol is: timeVisible per hand,
 * stabilized positions, tip velocities. One converter per stream.
 */
export class V6Converter {
  constructor({ box = INTERACTION_BOX, smoothing = 0.5 } = {}) {
    this.box = box;
    this.k = Math.min(1, Math.max(0, smoothing));   // stabilized = lerp(prev, now, 1 - k)
    this.seen = new Map();                            // hand id → { since, palm, tips: [5] }
    this.lastT = null;
    this.t = [0, 0, 0];
  }

  /**
   * @param {object} raw   {t:'f', id, fps, hands:[…]} (the line from leap-stream / mock)
   * @param {number} [tUs] timestamp in microseconds (default: now)
   */
  convert(raw, tUs = nowUs()) {
    const dt = this.lastT == null ? 0 : Math.max(0, (tUs - this.lastT) / 1e6);
    this.lastT = tUs;
    const hands = [], pointables = [], alive = new Set();
    for (const h of raw.hands || []) {
      alive.add(h.id);
      const left = h.side === 'L';
      let st = this.seen.get(h.id);
      if (!st) { st = { since: tUs, palm: h.palm.slice(), tips: h.f.map((d) => d[4].slice()), stips: h.f.map((d) => d[4].slice()) }; this.seen.set(h.id, st); }
      const a = 1 - this.k;
      st.palm = add(st.palm, mul(sub(h.palm, st.palm), a));
      const timeVisible = r3((tUs - st.since) / 1e6);
      const grab = h.grab, w = h.w || 80;
      const sphereRadius = r1(Math.max(35, 125 - 85 * grab));
      const [elbow, wrist] = h.arm || [sub(h.palm, [0, 30, -250]), sub(h.palm, [0, 0, -40])];
      hands.push({
        id: h.id,
        type: left ? 'left' : 'right',
        palmPosition: h.palm,
        stabilizedPalmPosition: rv(st.palm),
        palmVelocity: h.vel,
        palmNormal: h.n,
        direction: h.dir,
        sphereCenter: rv(add(h.palm, mul(h.n, sphereRadius * 0.5))),
        sphereRadius,
        pinchStrength: h.pinch,
        grabStrength: grab,
        confidence: h.conf,
        timeVisible,
        palmWidth: w,
        armWidth: r1(w * 0.7),
        armBasis: boneBasis(elbow, wrist, h.n, left),
        elbow,
        wrist,
        // motion since another frame (LeapJS hand.translation / rotationAngle): the palm itself and its basis
        r: palmBasis(h.dir, h.n, left), s: 1, t: h.palm,
      });
      for (let d = 0; d < 5; d++) {
        const p = h.f[d];
        const [carp, mcp, pip, dip, tip] = p;
        const tipVelocity = dt > 0 ? rv(mul(sub(tip, st.tips[d]), 1 / dt)) : [0, 0, 0];
        st.tips[d] = tip.slice();
        st.stips[d] = add(st.stips[d], mul(sub(tip, st.stips[d]), a));
        // touch emulation (the v1/v2 "virtual touch plane", here the plane z = 0 above the sensor)
        const touchDistance = r3(Math.max(-1, Math.min(1, tip[2] / 60)));
        const touchZone = touchDistance <= 0 ? 'touching' : tip[2] < 120 ? 'hovering' : 'none';
        pointables.push({
          id: h.id * 10 + d,
          handId: h.id,
          type: d,
          tool: false,
          direction: rv(unit(sub(tip, dip)), r3),
          tipPosition: tip,
          stabilizedTipPosition: rv(st.stips[d]),
          tipVelocity,
          length: r1(len(sub(pip, mcp)) + len(sub(dip, pip)) + len(sub(tip, dip))),
          width: r1(w * WIDTH[d]),
          extended: !!(h.ext && h.ext[d]),
          touchZone, touchDistance,
          timeVisible,
          carpPosition: carp, mcpPosition: mcp, pipPosition: pip, dipPosition: dip, btipPosition: tip,
          bases: [boneBasis(carp, mcp, h.n, left), boneBasis(mcp, pip, h.n, left), boneBasis(pip, dip, h.n, left), boneBasis(dip, tip, h.n, left)],
        });
      }
    }
    for (const id of [...this.seen.keys()]) if (!alive.has(id)) this.seen.delete(id);
    // frame.translation(since): the mean palm moves; with no hands it stays where it was
    if (hands.length) this.t = rv(hands.reduce((a, h) => add(a, mul(h.palmPosition, 1 / hands.length)), [0, 0, 0]));
    return {
      id: raw.id,
      timestamp: Math.round(tUs),
      currentFrameRate: raw.fps || 0,
      hands, pointables,
      interactionBox: { center: this.box.center.slice(), size: this.box.size.slice() },
      gestures: [],
      r: IDENTITY, s: 1, t: this.t.slice(),
    };
  }
}

/** Convenience: one-off conversion (fresh state). */
export function rawToV6(raw, tUs, opts) { return new V6Converter(opts).convert(raw, tUs); }

/** The first message on /vN.json. */
export function v6Header(serviceVersion = 'unknown', version = PROTOCOL_VERSION) {
  return { serviceVersion: String(serviceVersion), version: Math.max(1, Math.min(PROTOCOL_VERSION, version | 0 || PROTOCOL_VERSION)) };
}

/**
 * A LeapJS device event (protocol ≥ 5): LeapJS turns it into deviceAttached / deviceStreaming /
 * streamingStarted. `service` is ours (LeapJS ignores it): LeapInput tells "no tracking service"
 * from "no device" with it.
 */
export function deviceEvent({ device = null, service = true } = {}) {
  return { event: { type: 'deviceEvent', state: { attached: !!device, streaming: !!(device && service), id: device || 'none', type: 'Peripheral', service: !!service } } };
}

/** Which protocol version a /vN.json path asks for (null when it is not one). */
export function protocolOfPath(pathname) {
  const m = /^\/v(\d+)\.json$/.exec(pathname || '');
  return m ? Number(m[1]) : null;
}

/**
 * Either wire format → [hand]. v6 frames carry fingers as pointables (joined by handId);
 * raw frames carry them inline. Anything else → [].
 */
export function handsOf(msg) {
  if (!msg || !Array.isArray(msg.hands)) return [];
  if (msg.t === 'f') {
    return msg.hands.map((h) => ({
      id: h.id, side: h.side === 'L' ? 'left' : 'right', confidence: h.conf ?? 1,
      pinch: h.pinch ?? 0, grab: h.grab ?? 0, palm: h.palm, velocity: h.vel || [0, 0, 0],
      normal: h.n || [0, -1, 0], direction: h.dir || [0, 0, -1], width: h.w || 80,
      fingers: h.f || [], extended: (h.ext || []).map(Boolean),
      elbow: h.arm ? h.arm[0] : null, wrist: h.arm ? h.arm[1] : null, timeVisible: 0,
    }));
  }
  const byHand = new Map();
  for (const p of msg.pointables || []) {
    if (!byHand.has(p.handId)) byHand.set(p.handId, []);
    byHand.get(p.handId).push(p);
  }
  return msg.hands.map((h) => {
    const ps = (byHand.get(h.id) || []).slice().sort((a, b) => a.type - b.type);
    const fingers = [], extended = [];
    for (let d = 0; d < 5; d++) {
      const p = ps.find((x) => x.type === d);
      if (!p) { fingers.push([]); extended.push(false); continue; }
      const tip = p.btipPosition || p.tipPosition;
      fingers.push(p.carpPosition ? [p.carpPosition, p.mcpPosition, p.pipPosition, p.dipPosition, tip] : [tip]);
      extended.push(!!p.extended);
    }
    return {
      id: h.id, side: h.type === 'left' ? 'left' : 'right', confidence: h.confidence ?? 1,
      pinch: h.pinchStrength ?? 0, grab: h.grabStrength ?? 0, palm: h.palmPosition,
      velocity: h.palmVelocity || [0, 0, 0], normal: h.palmNormal || [0, -1, 0],
      direction: h.direction || [0, 0, -1], width: h.palmWidth || 80, fingers, extended,
      elbow: h.elbow || null, wrist: h.wrist || null, timeVisible: h.timeVisible ?? 0,
    };
  });
}

/** Bones to draw a hand: pairs of points, per finger plus the knuckle line and the arm. */
export function handBones(hand) {
  const bones = [];
  for (const f of hand.fingers) for (let i = 0; i + 1 < f.length; i++) bones.push([f[i], f[i + 1]]);
  const knuckles = hand.fingers.map((f) => f[1]).filter(Boolean);
  for (let i = 0; i + 1 < knuckles.length; i++) bones.push([knuckles[i], knuckles[i + 1]]);
  if (hand.wrist && hand.elbow) bones.push([hand.elbow, hand.wrist]);
  return bones;
}

function nowUs() {
  return typeof performance !== 'undefined' && performance.timeOrigin
    ? Math.round((performance.timeOrigin + performance.now()) * 1000)
    : Date.now() * 1000;
}
