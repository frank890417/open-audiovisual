// @openav/audio — realtime audio analysis → signals.
//
// Wraps Web Audio AnalyserNode. Sources: microphone, an <audio> element, or any
// AudioNode you already have (e.g. from Tone.js — we are neighbors, not rivals).
//
// Published signals (all 0..1 unless noted):
//   audio/rms          loudness (smoothed)
//   audio/peak         instantaneous peak
//   audio/band/low     energy 20–250 Hz
//   audio/band/mid     energy 250–2k Hz
//   audio/band/high    energy 2k–8k Hz
//   audio/centroid     spectral centroid (brightness), normalized
//   audio/onset        pulse — fires on transient (energy jump over adaptive floor)
//
// Drum separation (the TD audioAnalysis idiom, band-limited onsets — no ML):
//   audio/kick         pulse {level} — 20–120 Hz transient
//   audio/snare        pulse {level} — 150–800 Hz + broadband transient
//   audio/hat          pulse {level} — 6–14 kHz transient
//   audio/kick/env .snare/env .hat/env   0..1 continuous decay envelopes —
//   map these straight onto params (a kick that thumps a world is one route)
//
// Call update() once per frame (cheap: one getByteFrequencyData + one time-domain read).

export class AudioAnalyzer {
  /**
   * @param {object} opts
   * @param {import('../core/src/signals.js').Signals} [opts.signals]
   * @param {number} [opts.fftSize=2048]
   * @param {number} [opts.smooth=0.7] rms smoothing 0..1 (higher = smoother)
   */
  constructor({ signals = null, fftSize = 2048, smooth = 0.7 } = {}) {
    this.signals = signals;
    this.fftSize = fftSize;
    this.smooth = smooth;
    this.ctx = null; this.analyser = null; this.source = null;
    this._freq = null; this._time = null;
    this._rms = 0;
    this._onsetFloor = 0; this._lastOnsetAt = 0;
    // per-drum adaptive floors, refractory clocks, and decay envelopes
    this._drum = {
      kick:  { lo: 20,   hi: 120,   floor: 0, at: 0, env: 0, refract: 90 },
      snare: { lo: 150,  hi: 800,   floor: 0, at: 0, env: 0, refract: 90 },
      hat:   { lo: 6000, hi: 14000, floor: 0, at: 0, env: 0, refract: 60 },
    };
    if (signals) {
      for (const n of ['audio/rms', 'audio/peak', 'audio/band/low', 'audio/band/mid', 'audio/band/high', 'audio/centroid',
        'audio/kick/env', 'audio/snare/env', 'audio/hat/env'])
        signals.define(n, { source: 'audio' });
      for (const n of ['audio/onset', 'audio/kick', 'audio/snare', 'audio/hat'])
        signals.define(n, { kind: 'pulse', source: 'audio' });
    }
  }

  async enableMic() {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } });
    this._setup();
    this.source = this.ctx.createMediaStreamSource(stream);
    this.source.connect(this.analyser);
    return true;
  }

  /** Analyze an <audio>/<video> element (it keeps playing to speakers). */
  enableElement(el) {
    this._setup();
    this.source = this.ctx.createMediaElementSource(el);
    this.source.connect(this.analyser);
    this.analyser.connect(this.ctx.destination);
    return true;
  }

  /** Bring your own node (Tone.js etc.): node.connect(analyzer.input()). */
  input() { this._setup(); return this.analyser; }

  _setup() {
    if (this.ctx) return;
    this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    this.analyser = this.ctx.createAnalyser();
    this.analyser.fftSize = this.fftSize;
    this.analyser.smoothingTimeConstant = 0.5;
    this._freq = new Uint8Array(this.analyser.frequencyBinCount);
    this._time = new Uint8Array(this.fftSize);
  }

  /** Call once per frame. Returns the features object (also published as signals). */
  update() {
    if (!this.analyser) return null;
    if (this.ctx.state === 'suspended') this.ctx.resume();
    this.analyser.getByteFrequencyData(this._freq);
    this.analyser.getByteTimeDomainData(this._time);

    // rms + peak from time domain
    let sum = 0, peak = 0;
    for (let i = 0; i < this._time.length; i++) {
      const v = (this._time[i] - 128) / 128;
      sum += v * v; const a = Math.abs(v); if (a > peak) peak = a;
    }
    const rmsNow = Math.sqrt(sum / this._time.length);
    this._rms = this._rms * this.smooth + rmsNow * (1 - this.smooth);

    // bands + centroid from frequency domain
    const nyquist = this.ctx.sampleRate / 2, n = this._freq.length;
    const hzPerBin = nyquist / n;
    const bandEnergy = (lo, hi) => {
      const a = Math.max(0, Math.floor(lo / hzPerBin)), b = Math.min(n - 1, Math.ceil(hi / hzPerBin));
      let s = 0; for (let i = a; i <= b; i++) s += this._freq[i];
      return b >= a ? s / ((b - a + 1) * 255) : 0;
    };
    const low = bandEnergy(20, 250), mid = bandEnergy(250, 2000), high = bandEnergy(2000, 8000);
    let wsum = 0, esum = 0;
    for (let i = 0; i < n; i++) { wsum += i * this._freq[i]; esum += this._freq[i]; }
    const centroid = esum > 0 ? (wsum / esum) / n : 0;

    // onset: energy jump over an adaptive floor, refractory 100ms
    const now = performance.now();
    let onset = false;
    if (rmsNow > this._onsetFloor * 1.6 + 0.02 && now - this._lastOnsetAt > 100) {
      onset = true; this._lastOnsetAt = now;
    }
    this._onsetFloor = this._onsetFloor * 0.95 + rmsNow * 0.05;

    // drum separation: per-band transient over adaptive floor + refractory,
    // each with a decay envelope (τ≈120ms) published as a continuous signal
    const drums = {};
    for (const name of Object.keys(this._drum)) {
      const d = this._drum[name];
      const e = bandEnergy(d.lo, d.hi);
      let hit = false;
      if (e > d.floor * 1.7 + 0.03 && now - d.at > d.refract) { hit = true; d.at = now; d.env = Math.min(1, e * 2); }
      d.floor = d.floor * 0.92 + e * 0.08;
      d.env *= 0.88;                      // ~120ms decay at 60fps
      drums[name] = { hit, level: e, env: d.env };
    }

    const f = { rms: this._rms, peak, low, mid, high, centroid, onset,
      kick: drums.kick, snare: drums.snare, hat: drums.hat };
    if (this.signals) {
      this.signals.set('audio/rms', f.rms);
      this.signals.set('audio/peak', f.peak);
      this.signals.set('audio/band/low', f.low);
      this.signals.set('audio/band/mid', f.mid);
      this.signals.set('audio/band/high', f.high);
      this.signals.set('audio/centroid', f.centroid);
      if (onset) this.signals.pulse('audio/onset', { rms: rmsNow });
      for (const name of ['kick', 'snare', 'hat']) {
        this.signals.set(`audio/${name}/env`, drums[name].env);
        if (drums[name].hit) this.signals.pulse(`audio/${name}`, { level: drums[name].level });
      }
    }
    return f;
  }
}
