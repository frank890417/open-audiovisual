// @openav/remote · sensors — the phone's body as signals.
//
// Ported from cheyuwu-lab's runtime/control.html (field-tested on real iPhones):
// same signal names, same thresholds, same iOS permission dance. What changed:
// it is a class with no DOM in it, and tilt is expressed in SCREEN axes, so a
// phone turned sideways still reports "tilt right = +x".
//
// Signals (all under phone/<id>/ — the caller prefixes):
//   tilt/x  tilt/y        -1..1   ±45° from the calibrated rest pose; x right, y toward you (down-screen)
//   orient/alpha|beta|gamma  deg  raw deviceorientation
//   accel/x|y|z           m/s²    including gravity
//   rot/alpha|beta|gamma  deg/s   rotationRate
//   knock                 pulse   {strength 0..1, delta, t}  — an acceleration jolt over a threshold
//   light                 0..1    front-camera mean luma (opt-in; iOS needs HTTPS)
//   touch/…               see attachTouchPad()
//
// The same class serves two places: the /remote phone page (relay → a show elsewhere) and
// localSensors() below (the show page ITSELF running on a phone — no relay, straight into its Signals).

import { fileSignal, aliasOf } from '../relay/signals.js?v=32849c5';

const clamp = (x, a, b) => Math.min(b, Math.max(a, x));

export class PhoneSensors {
  /**
   * @param {{set:(name:string,v:number)=>void, send:(name:string,v:any,pulse?:boolean)=>void}} io  names WITHOUT the phone/<id>/ prefix
   * @param {{onKnock?:(strength:number)=>void, onSample?:(name:string,v:number)=>void, notify?:(msg:string)=>void}} [hooks]
   */
  constructor(io, hooks = {}) {
    this.io = io; this.hooks = hooks;
    this.started = false; this.gotSensor = false; this.denied = false;   // denied: iOS said no (stays no until Settings)
    this.rest = { x: 0, y: 0 };            // calibration offset, degrees, screen frame
    this.deg = { x: 0, y: 0 };
    this.threshold = 10;                   // m/s² vector change
    this.COOLDOWN = 130;                   // ms — one tap must not read as three
    this._prev = null; this._lastKnock = 0;
    this._onOrient = this._onOrient.bind(this); this._onMotion = this._onMotion.bind(this);
    this.camStream = null; this.camTimer = null;
  }

  /** MUST be called inside a user gesture (iOS permission rules). Both
   *  requestPermission() calls are issued synchronously before awaiting. */
  async start() {
    if (this.started) return true;
    const DM = window.DeviceMotionEvent, DO = window.DeviceOrientationEvent;
    const ps = [];
    if (DM && typeof DM.requestPermission === 'function') ps.push(DM.requestPermission());
    if (DO && typeof DO.requestPermission === 'function') ps.push(DO.requestPermission());
    try {
      const rs = await Promise.all(ps);
      if (rs.some((r) => r !== 'granted')) { this.denied = true; this.hooks.notify?.('感測器授權被拒絕。到 設定 → Safari → 動作與方向 開啟，再重載。'); }
    } catch (err) { this.denied = true; this.hooks.notify?.('感測器授權失敗：' + (err && err.message)); }
    window.addEventListener('deviceorientation', this._onOrient);
    window.addEventListener('devicemotion', this._onMotion);
    this.started = true;
    setTimeout(() => { if (!this.gotSensor) this.hooks.notify?.(window.isSecureContext ? '沒有收到感測資料：這台裝置沒有感測器。' : '沒有收到感測資料：iOS 的感測器要 HTTPS（請用 tunnel 網址）。觸控與琴鍵仍可用。'); }, 2500);
    return true;
  }
  stop() {
    window.removeEventListener('deviceorientation', this._onOrient);
    window.removeEventListener('devicemotion', this._onMotion);
    this.started = false; this.setCamera(false);
  }

  calibrate() { this.rest = { x: this.deg.x, y: this.deg.y }; }
  cycleThreshold() { this.threshold = this.threshold >= 24 ? 4 : this.threshold + 2; return this.threshold; }

  /** Rotate (gamma, beta) into screen axes using the current screen angle. */
  static screenTilt(beta, gamma, angle = 0) {
    switch (((angle % 360) + 360) % 360) {
      case 90: return { x: beta, y: -gamma };
      case 180: return { x: -gamma, y: -beta };
      case 270: return { x: -beta, y: gamma };
      default: return { x: gamma, y: beta };
    }
  }

  _put(name, v) { this.io.set(name, v); this.hooks.onSample?.(name, v); }

  _onOrient(e) {
    if (e.beta == null && e.gamma == null) return;
    this.gotSensor = true;
    const angle = (screen.orientation && screen.orientation.angle) ?? window.orientation ?? 0;
    this.deg = PhoneSensors.screenTilt(e.beta || 0, e.gamma || 0, angle);
    this._put('tilt/x', +clamp((this.deg.x - this.rest.x) / 45, -1, 1).toFixed(4));
    this._put('tilt/y', +clamp((this.deg.y - this.rest.y) / 45, -1, 1).toFixed(4));
    this._put('orient/alpha', +(e.alpha || 0).toFixed(1)); this._put('orient/beta', +(e.beta || 0).toFixed(1)); this._put('orient/gamma', +(e.gamma || 0).toFixed(1));
  }

  _onMotion(e) {
    const a = e.accelerationIncludingGravity;
    if (a && a.x != null) {
      this.gotSensor = true;
      this._put('accel/x', +a.x.toFixed(3)); this._put('accel/y', +a.y.toFixed(3)); this._put('accel/z', +a.z.toFixed(3));
      if (this._prev) {
        const d = Math.hypot(a.x - this._prev.x, a.y - this._prev.y, a.z - this._prev.z);
        const now = performance.now();
        if (d > this.threshold && now - this._lastKnock > this.COOLDOWN) {
          this._lastKnock = now;
          const strength = +clamp(0.15 + (d - this.threshold) / (this.threshold * 2.5), 0, 1).toFixed(3);
          this.io.send('knock', { strength, delta: +d.toFixed(2), t: Date.now() }, true);
          this.hooks.onKnock?.(strength);
          try { navigator.vibrate && navigator.vibrate(10); } catch {}
        }
      }
      this._prev = { x: a.x, y: a.y, z: a.z };
    }
    const r = e.rotationRate;
    if (r && r.alpha != null) { this._put('rot/alpha', +r.alpha.toFixed(2)); this._put('rot/beta', +r.beta.toFixed(2)); this._put('rot/gamma', +r.gamma.toFixed(2)); }
  }

  /** 光照：front-camera mean luma, 32×24 samples @10 Hz. Needs a gesture + HTTPS on iOS. */
  async setCamera(on) {
    if (!on) {
      if (this.camStream) this.camStream.getTracks().forEach((t) => t.stop());
      this.camStream = null; clearInterval(this.camTimer); this.camTimer = null; return true;
    }
    try {
      this.camStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: 160, height: 120 }, audio: false });
      const v = document.createElement('video'); v.muted = true; v.playsInline = true; v.srcObject = this.camStream; await v.play();
      const cv = document.createElement('canvas'); cv.width = 32; cv.height = 24;
      const cx = cv.getContext('2d', { willReadFrequently: true });
      this.camTimer = setInterval(() => {
        cx.drawImage(v, 0, 0, 32, 24);
        const d = cx.getImageData(0, 0, 32, 24).data; let s = 0;
        for (let i = 0; i < d.length; i += 4) s += 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2];
        this._put('light', +(s / (32 * 24 * 255)).toFixed(4));
      }, 100);
      return true;
    } catch (err) {
      this.hooks.notify?.('攝影機不可用：' + (err && err.message) + (window.isSecureContext ? '' : '（需要 HTTPS）'));
      return false;
    }
  }
}

/** Multi-touch pad → touch/x,y,down (finger 0) and touch/<n>/… (n ≥ 1), touch/count. */
export function attachTouchPad(pad, io, { onMove, onEnd } = {}) {
  const slots = new Map();                       // pointerId → slot
  const nm = (slot, f) => (slot === 0 ? 'touch/' : `touch/${slot}/`) + f;
  const at = (e) => { const r = pad.getBoundingClientRect(); return [clamp((e.clientX - r.left) / r.width, 0, 1), clamp((e.clientY - r.top) / r.height, 0, 1)]; };
  const put = (slot, e) => { const [x, y] = at(e); io.set(nm(slot, 'x'), +x.toFixed(4)); io.set(nm(slot, 'y'), +y.toFixed(4)); return [x, y]; };
  pad.addEventListener('pointerdown', (e) => {
    e.preventDefault(); try { pad.setPointerCapture(e.pointerId); } catch {}
    let slot = 0; const used = new Set([...slots.values()].map((s) => s.slot));
    while (used.has(slot)) slot++;
    slots.set(e.pointerId, { slot });
    const [x, y] = put(slot, e);
    io.set(nm(slot, 'down'), 1); io.set('touch/count', slots.size);
    onMove?.(slot, x, y, true);
  });
  pad.addEventListener('pointermove', (e) => { const s = slots.get(e.pointerId); if (s) { e.preventDefault(); const [x, y] = put(s.slot, e); onMove?.(s.slot, x, y, true); } });
  const up = (e) => { const s = slots.get(e.pointerId); if (!s) return; slots.delete(e.pointerId); io.set(nm(s.slot, 'down'), 0); io.set('touch/count', slots.size); onEnd?.(s.slot); };
  pad.addEventListener('pointerup', up); pad.addEventListener('pointercancel', up);
  io.set('touch/down', 0); io.set('touch/count', 0);
}

/** The show page ITSELF on a phone: its own DeviceMotion/Orientation straight into `signals`, no relay.
 *  Same names and thresholds as a remote phone, under `prefix` (default phone/local/), and — like
 *  bindSignals does for remote phones — mirrored to phone/any/… so routes written for "the latest phone"
 *  work whether the phone is in your hand as a controller or IS the show. `alias: null` turns that off.
 *  Returns the PhoneSensors; call `.start()` from a user gesture (iOS permission rules; HTTPS on iOS). */
export function localSensors(signals, { prefix = 'phone/local/', alias = 'any', source = 'local', hooks = {} } = {}) {
  const put = (n, v, pulse) => {
    const name = prefix + n;
    fileSignal(signals, name, v, { pulse, source });
    const a = alias && aliasOf(name, alias);
    if (a) fileSignal(signals, a, v, { pulse, source });
  };
  return new PhoneSensors({ set: (n, v) => put(n, v, false), send: (n, v, pulse) => put(n, v, !!pulse) }, hooks);
}
