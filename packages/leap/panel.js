// @openav/leap · panel — "is the Leap alive, and what does it see?" at a glance.
//
// One status line (bridge → service → device → hands, each step named so a performer knows
// which one to fix) and a small front-view skeleton. Used by the console's L1 section
// (createShow modules.leap) and by the lab's ✋ panel. It redraws on frames and status
// changes only — nothing runs while the sensor is idle.

const HINT = {
  idle: 'not connected',
  connecting: 'no bridge on 127.0.0.1:6437 — run: node packages/leap/bridge/leap-bridge.mjs',
  bridge: 'bridge up · waiting for the tracking service',
  'no-service': 'bridge up · Ultraleap tracking service not running',
  'no-device': 'service up · no Leap Motion device plugged in',
  tracking: 'tracking',
  simulated: 'simulated (mouse / touch)',
  closed: 'closed',
};
const DOT = { tracking: '#37c978', simulated: '#7aa6ff', bridge: '#ffd166', 'no-service': '#ff9f43', 'no-device': '#ff9f43', connecting: '#ff5a5f', closed: '#556', idle: '#556' };

/**
 * @param {HTMLElement} el      where to put it
 * @param {import('./index.js?v=a8b6135').LeapInput} leap
 * @param {object} [o]
 * @param {number} [o.width=300] canvas CSS width; height follows the interaction box (≈ 0.62 × width)
 * @param {boolean} [o.simulate=true] show a "simulate" toggle (mouse/touch → hands)
 * @param {HTMLElement|Window} [o.simTarget] what the simulator listens on (default: window)
 */
export function mountLeapPanel(el, leap, { width = 300, simulate = true, simTarget } = {}) {
  const doc = el.ownerDocument || document;
  const root = doc.createElement('div');
  root.className = 'oav-leap';
  root.style.cssText = 'display:flex;flex-direction:column;gap:6px;font:11px/1.4 ui-monospace,SFMono-Regular,Menlo,monospace;color:#cfd6e4';
  const line = doc.createElement('div');
  line.style.cssText = 'display:flex;align-items:center;gap:6px;flex-wrap:wrap';
  const dot = doc.createElement('i');
  dot.style.cssText = 'width:8px;height:8px;border-radius:50%;flex:none;display:inline-block';
  const text = doc.createElement('span');
  text.style.cssText = 'flex:1;min-width:0';
  line.append(dot, text);
  let simBtn = null;
  if (simulate) {
    simBtn = doc.createElement('button');
    simBtn.type = 'button';
    simBtn.textContent = 'simulate';
    simBtn.title = 'no sensor? move = right palm · press = pinch · right-click = grab · Shift = left hand · wheel = depth';
    simBtn.style.cssText = 'background:#1a2030;color:#cfd6e4;border:1px solid #2a3348;border-radius:6px;padding:2px 8px;font:inherit;cursor:pointer';
    simBtn.onclick = () => {
      if (leap.simulating) leap.stopSimulation(); else leap.simulate({ target: simTarget || leap.simTarget || doc.defaultView });
      paint();
    };
    line.append(simBtn);
  }
  const canvas = doc.createElement('canvas');
  const h = Math.round(width * 0.62);
  const dpr = Math.min(2, (doc.defaultView && doc.defaultView.devicePixelRatio) || 1);
  canvas.width = Math.round(width * dpr); canvas.height = Math.round(h * dpr);
  canvas.style.cssText = `width:${width}px;max-width:100%;height:auto;aspect-ratio:${width}/${h};background:#0a0d14;border:1px solid #1c2334;border-radius:6px`;
  root.append(line, canvas);
  el.appendChild(root);
  const ctx = canvas.getContext('2d');

  function paint() {
    const s = leap.status;
    dot.style.background = DOT[s] || '#556';
    const n = leap.hands.length;
    const bits = [HINT[s] || s];
    if (s === 'tracking' || s === 'simulated') {
      bits[0] = s === 'simulated' ? HINT.simulated : (leap.device ? `tracking · ${String(leap.device).slice(0, 14)}` : 'tracking');
      bits.push(`${n} hand${n === 1 ? '' : 's'}`);
      if (leap.fps) bits.push(`${Math.round(leap.fps)} fps`);
      for (const hd of leap.hands) {
        const g = leap.gestures.state[hd.side] || {};
        if (g.pinch || g.grab) bits.push(`${hd.side[0].toUpperCase()}:${g.grab ? 'grab' : 'pinch'}`);
      }
    }
    text.textContent = bits.join(' · ');
    if (simBtn) simBtn.style.background = leap.simulating ? '#2e6df6' : '#1a2030';
    if (!ctx) return;
    const W = canvas.width, H = canvas.height;
    ctx.clearRect(0, 0, W, H);
    // a view 1.6× the interaction box, with the box itself outlined: a hand outside it is visibly
    // outside (its signals sit clamped at the edge)
    const ib = leap.box, view = { center: ib.center, size: ib.size.map((v) => v * 1.6) };
    const c = ib.center, hs = ib.size.map((v) => v / 2);
    const corner = (sx, sy, sz) => leap.project([c[0] + sx * hs[0], c[1] + sy * hs[1], c[2] + sz * hs[2]], W, H, { box: view });
    ctx.strokeStyle = '#1c2334'; ctx.lineWidth = 1 * dpr;
    for (const [a, b] of [[[-1, -1, -1], [1, -1, -1]], [[1, -1, -1], [1, -1, 1]], [[1, -1, 1], [-1, -1, 1]], [[-1, -1, 1], [-1, -1, -1]],
      [[-1, 1, -1], [1, 1, -1]], [[-1, -1, -1], [-1, 1, -1]], [[1, -1, -1], [1, 1, -1]]]) {
      const p = corner(...a), q = corner(...b);
      ctx.beginPath(); ctx.moveTo(p[0], p[1]); ctx.lineTo(q[0], q[1]); ctx.stroke();
    }
    const [sx, sy] = leap.project([0, 0, 0], W, H, { box: view });              // the sensor
    ctx.fillStyle = '#2a3348'; ctx.fillRect(sx - 14 * dpr, Math.min(H - 4 * dpr, sy), 28 * dpr, 3 * dpr);
    leap.skeleton(ctx, W, H, { box: view, lineWidth: 1.6 * dpr });
  }
  let pending = false;
  const raf = (cb) => (doc.defaultView && doc.defaultView.requestAnimationFrame ? doc.defaultView.requestAnimationFrame(cb) : setTimeout(cb, 16));
  const offF = leap.onFrame(() => { if (!pending) { pending = true; raf(() => { pending = false; paint(); }); } });
  const offS = leap.onStatus(paint);
  paint();
  return {
    el: root,
    render: paint,
    destroy() { offF(); offS(); root.remove(); },
  };
}
