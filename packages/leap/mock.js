// @openav/leap · mock — plausible hands without a sensor.
//
// Two uses, one geometry:
//   mockFrame(t)        the bridge's --mock stream: a right hand circling and pinching every 3 s,
//                       a left hand rising and falling and slowly making a fist; every 12 s both
//                       pinch together (so both-pinch fires too). Deterministic in t, so tests can
//                       ask "is the right hand pinched at t = 2.0?".
//   mockHand({...})     one hand from a palm position + pinch + grab (+ roll/yaw): the browser
//                       simulator builds hands from the mouse with it.
// Output is The Last Input's raw line format (frame.js), so it flows through exactly the same
// conversion and publishing as a real Leap Motion Controller.

const RAD = Math.PI / 180;
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const mul = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
const lerp = (a, b, k) => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const r1 = (v) => Math.round(v * 10) / 10 + 0;      // + 0: no -0 on the wire
const r3 = (v) => Math.round(v * 1000) / 1000 + 0;
const rv = (a, f = r1) => [f(a[0]), f(a[1]), f(a[2])];
const clamp01 = (v) => Math.min(1, Math.max(0, v));

// bone lengths (mm): [metacarpal, proximal, intermediate, distal]; the thumb's metacarpal is 0, as in LeapC
const BONES = [[0, 46, 32, 24], [66, 42, 25, 20], [64, 46, 28, 21], [60, 43, 26, 21], [56, 34, 19, 19]];
// knuckle offsets from the palm centre: [toward thumb, forward]
const KNUCKLE = [[30, -38], [24, 40], [7, 44], [-11, 41], [-28, 34]];
const CARP = [[28, -40], [14, -45], [3, -46], [-8, -45], [-18, -42]];

/**
 * One hand in the raw format.
 * @param {object} o
 * @param {number} o.id
 * @param {'L'|'R'} o.side
 * @param {number[]} o.palm        [x,y,z] mm
 * @param {number} [o.pinch=0]     0..1 thumb ↔ index
 * @param {number} [o.grab=0]      0..1 fist
 * @param {number} [o.roll=0]      radians, + = rolls toward the thumb side
 * @param {number} [o.yaw=0]       radians, + = fingers turn toward +x
 * @param {number} [o.pitch=0]     radians, + = fingers tip up
 * @param {number[]} [o.vel]       palm velocity mm/s
 */
export function mockHand({ id = 1, side = 'R', palm = [0, 200, 0], pinch = 0, grab = 0, roll = 0, yaw = 0, pitch = 0, vel = [0, 0, 0], conf = 1, width = 85 } = {}) {
  pinch = clamp01(pinch); grab = clamp01(grab);
  // forward (toward the fingertips), normal (out of the palm, down when the palm faces the sensor)
  let f = [Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), -Math.cos(yaw) * Math.cos(pitch)];
  const n0 = [0, -Math.cos(pitch), -Math.sin(pitch)];
  // roll the normal about f
  const s0 = cross(n0, f);                                  // pinky side of a right hand
  const thumbDir = side === 'R' ? mul(s0, -1) : s0;
  const n = add(mul(n0, Math.cos(roll)), mul(thumbDir, Math.sin(roll)));
  const thumbSide = side === 'R' ? mul(cross(n, f), -1) : cross(n, f);
  const at = (lat, fwd, down = 0) => add(add(add(palm, mul(thumbSide, lat)), mul(f, fwd)), mul(n, down));
  const pinchPoint = at(16, 80, 32);

  const fingers = [], ext = [];
  for (let d = 0; d < 5; d++) {
    const [, pl, il, dl] = BONES[d];
    const carp = at(CARP[d][0], CARP[d][1], 4);
    const mcp = d === 0 ? carp : at(KNUCKLE[d][0], KNUCKLE[d][1]);
    // curl: each joint bends toward the palm; the thumb swings across instead
    const curl = d === 0 ? grab * 0.6 + pinch * 0.3 : grab + (d === 1 ? pinch * 0.35 : 0);
    const a1 = curl * 70 * RAD, a2 = a1 + curl * 85 * RAD, a3 = a2 + curl * 55 * RAD;
    const base = d === 0 ? add(mul(thumbSide, 0.55), mul(f, 0.83)) : f;
    const dirAt = (a) => add(mul(base, Math.cos(a)), mul(n, Math.sin(a)));
    const spread = d === 0 ? 0 : (2 - d) * 0.07 * (1 - grab);
    const b = add(base, mul(thumbSide, spread));
    const dir0 = d === 0 ? b : add(mul(b, Math.cos(a1)), mul(n, Math.sin(a1)));
    const pip = add(mcp, mul(d === 0 ? dirAt(a1 * 0.5) : dir0, pl));
    let dip = add(pip, mul(dirAt(a2), il));
    let tip = add(dip, mul(dirAt(a3), dl));
    if (d <= 1 && pinch > 0) {                              // thumb and index tips meet at the pinch point
      tip = lerp(tip, pinchPoint, pinch);
      dip = lerp(dip, lerp(pip, pinchPoint, 0.55), pinch * 0.8);
    }
    fingers.push([rv(carp), rv(mcp), rv(pip), rv(dip), rv(tip)]);
    ext.push(curl < 0.45 && !(d <= 1 && pinch > 0.6) ? 1 : 0);
  }
  const wrist = at(0, -58, 6);
  const elbow = add(add(wrist, mul(f, -235)), mul(n, 55));
  return {
    id, side, conf: r3(conf), pinch: r3(pinch), grab: r3(grab),
    palm: rv(palm), vel: rv(vel), n: rv(n, r3), dir: rv(f, r3), w: r1(width),
    f: fingers, ext, arm: [rv(elbow), rv(wrist)],
  };
}

// a smooth 0→1→0 bump inside [start, start+len) of a repeating cycle
const bump = (t, period, start, length) => {
  const p = ((t % period) + period) % period - start;
  return p >= 0 && p < length ? Math.sin(Math.PI * p / length) : 0;
};

function rightAt(t) {
  return { palm: [55 + Math.cos(t * 0.9) * 50, 210 + Math.sin(t * 1.3) * 45, Math.sin(t * 0.9) * 55], pinch: clamp01(1.15 * bump(t, 3, 1.5, 1.05)), grab: 0, roll: Math.sin(t * 0.7) * 0.35, yaw: Math.sin(t * 0.5) * 0.25 };
}
function leftAt(t) {
  return { palm: [-75 + Math.sin(t * 0.4) * 20, 195 + Math.sin(t * 0.5) * 70, Math.cos(t * 0.6) * 25], pinch: clamp01(1.15 * bump(t, 12, 7.5, 1.05)), grab: (Math.sin(t * 0.35 - 1.2) + 1) / 2, roll: -Math.sin(t * 0.6) * 0.3, yaw: 0 };
}

/**
 * The --mock stream: frame `id` at time t seconds. Velocity is the analytic difference over one
 * 60 Hz step, so speed signals move too.
 */
export function mockFrame(t, id = Math.round(t * 60), { hands = 2 } = {}) {
  const dt = 1 / 60;
  const make = (at, hid, side) => {
    const a = at(t), b = at(t - dt);
    return mockHand({ id: hid, side, ...a, vel: mul([a.palm[0] - b.palm[0], a.palm[1] - b.palm[1], a.palm[2] - b.palm[2]], 1 / dt) });
  };
  const list = [make(rightAt, 1, 'R'), make(leftAt, 2, 'L')].slice(0, Math.max(0, hands));
  return { t: 'f', id, fps: 60, hands: list };
}
