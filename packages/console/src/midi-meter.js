// MidiMeter — per-channel MIDI OUT visualization (engine-level observer).
//
// Lineage: The Last Input core/midi-meter.js — the on-stage "what is every
// channel sending" panel, ported verbatim (data model, decay physics, pitch-range
// map). Hook: midi.onSend = bytes => meter.ingest(bytes, tSec) — send() is the
// single throat all outgoing bytes pass through, so what you see here is
// exactly what the DAW/synth receives. Data layer is renderer-free and
// unit-testable in Node.
//
// 每 channel 的資料模型：
//   env    包絡（attack 即時、release 指數衰減 τ=0.55s；有 held 長音時地板= max(heldVel)×0.85——「還按著」看得見）
//   peak   峰值（hold 1.1s 再衰減）· flash  note-on 閃光（τ=90ms）· at  aftertouch 壓力（ch1 建築長高脈動）
//   held   持續音 Map(pitch→vel)（note-off / CC123/120 panic 清除）
//   dots   最近音符 ring（畫「音域地圖」：x=音高、亮度=新舊、大小=力度）
//   rate   每秒事件數（1s 視窗）· cc  Map(cc#→{v,t})（ch16 的 CC1-12 畫成 lane）
export const NOTE_MIN = 12, NOTE_MAX = 120;

export class MidiMeter {
  constructor(opts = {}) {
    this.ch = Array.from({ length: 16 }, () => ({
      env: 0, peak: 0, peakT: -1e9, flash: 0, at: 0,
      held: new Map(), dots: [], evCount: 0, rate: 0, cc: new Map(), lastT: -1e9,
    }));
    this.tauEnv = opts.tauEnv ?? 0.55; this.tauFlash = 0.09;
    this.peakHold = 1.1; this.tauPeak = 0.35; this.tauAT = 0.8;
    this.dotLife = 3.0;                    // 音符點 3s 淡出
    this._lastDecay = null;
    this.totalRate = 0; this._totalCount = 0; this._rateT = 0;
  }

  // 引擎 onSend 掛這裡（bytes=[status,d1,d2]、now=秒）。note-off 只做 bookkeeping 不算事件。
  ingest(bytes, now) {
    const [st, d1, d2] = bytes; if (st == null) return;
    const type = st & 0xf0, c = this.ch[st & 0x0f]; if (!c) return;
    if (type === 0x90 && d2 > 0) {
      const v = d2 / 127;
      c.env = Math.max(c.env, v); c.flash = 1;
      if (v >= c.peak) { c.peak = v; c.peakT = now; }
      c.held.set(d1, v);
      c.dots.push({ p: d1, v, t: now }); if (c.dots.length > 28) c.dots.shift();
      c.evCount++; this._totalCount++; c.lastT = now;
    } else if (type === 0x80 || (type === 0x90 && d2 === 0)) {
      c.held.delete(d1);
    } else if (type === 0xa0) {            // poly aftertouch（建築長高）
      c.at = Math.max(c.at, (d2 | 0) / 127); c.env = Math.max(c.env, (d2 | 0) / 127 * 0.6);
      c.evCount++; this._totalCount++; c.lastT = now;
    } else if (type === 0xb0) {
      if (d1 === 123 || d1 === 120) c.held.clear();            // panic：清 held，不當訊號畫
      else if (d1 < 120) { c.cc.set(d1, { v: d2 / 127, t: now }); c.evCount++; this._totalCount++; c.lastT = now; }
    }
  }

  // 時間衰減（每 render 幀呼叫；隱藏重開 dt clamp 0.25s 不爆衝）。純數學，可單測。
  decay(now) {
    const dt = Math.max(0, Math.min(0.25, now - (this._lastDecay ?? now))); this._lastDecay = now;
    const kE = Math.exp(-dt / this.tauEnv), kF = Math.exp(-dt / this.tauFlash), kP = Math.exp(-dt / this.tauPeak), kA = Math.exp(-dt / this.tauAT);
    for (const c of this.ch) {
      let floor = 0;
      if (c.held.size) for (const v of c.held.values()) if (v * 0.85 > floor) floor = v * 0.85;
      c.env = Math.max(floor, c.env * kE);
      c.flash *= kF; c.at *= kA;
      if (now - c.peakT > this.peakHold) c.peak *= kP;
      while (c.dots.length && now - c.dots[0].t > this.dotLife && !c.held.has(c.dots[0].p)) c.dots.shift();
    }
    if (now - this._rateT >= 1) {
      for (const c of this.ch) { c.rate = c.evCount; c.evCount = 0; }
      this.totalRate = this._totalCount; this._totalCount = 0; this._rateT = now;
    }
  }

  // ── 渲染（canvas 2D；labels/colors 由作品層傳入，本模組不知道「病毒」是什麼）──
  // extra = { muted, ecoVoice, prox, envMix }（可選：header 狀態徽章）
  render(ctx, w, h, now, labels = [], colors = [], extra = {}) {
    ctx.clearRect(0, 0, w, h);
    const HEAD = 18, CCH = 20, rowH = (h - HEAD - CCH) / 16;
    const X_LBL = 6, W_LBL = 86, X_BAR = W_LBL + 10, W_BAR = 92, X_STRIP = X_BAR + W_BAR + 8, W_STRIP = w - X_STRIP - 44, X_RATE = w - 40;
    ctx.textBaseline = 'middle';
    // header：總流量 + 狀態徽章
    ctx.font = '9px monospace'; ctx.fillStyle = '#56708c';
    let hd = `${this.totalRate}/s`;
    if (extra.muted) hd += '  ·  🔇 MASTER MUTE';
    if (extra.ecoVoice != null && extra.ecoVoice < 0.98) hd += `  ·  eco ${(extra.ecoVoice * 100) | 0}%`;
    if (extra.prox != null) hd += `  ·  🎥 貼近 ${(extra.prox * 100) | 0}% / 環境 ${(extra.envMix * 100) | 0}%`;
    ctx.fillText(hd, X_LBL, HEAD / 2);
    for (let i = 0; i < 16; i++) {
      const c = this.ch[i], y = HEAD + i * rowH, cy = y + rowH / 2;
      const col = colors[i] || '#9cd2ff';
      const active = c.env > 0.004 || c.held.size > 0;
      // 底線
      ctx.fillStyle = 'rgba(255,255,255,.03)'; ctx.fillRect(X_LBL, y + rowH - 1, w - 12, 1);
      // 標籤（活躍變亮）
      ctx.font = '9.5px monospace';
      ctx.fillStyle = active ? col : '#4a5568';
      ctx.fillText(labels[i] || `ch${i + 1}`, X_LBL, cy);
      // 包絡條（軌道 + env 填色 + flash 白閃 + peak 刻線 + AT 内芯）
      ctx.fillStyle = 'rgba(255,255,255,.05)'; ctx.fillRect(X_BAR, cy - 3.5, W_BAR, 7);
      if (c.env > 0.004) {
        ctx.globalAlpha = 0.85; ctx.fillStyle = col;
        ctx.fillRect(X_BAR, cy - 3.5, W_BAR * Math.min(1, c.env), 7);
        ctx.globalAlpha = 1;
      }
      if (c.at > 0.02) { ctx.fillStyle = 'rgba(255,255,255,.75)'; ctx.fillRect(X_BAR, cy - 1, W_BAR * Math.min(1, c.at), 2); }   // aftertouch 白芯
      if (c.flash > 0.02) { ctx.globalAlpha = c.flash * 0.9; ctx.fillStyle = '#fff'; ctx.fillRect(X_BAR, cy - 3.5, W_BAR * Math.min(1, c.env || c.flash), 7); ctx.globalAlpha = 1; }
      if (c.peak > 0.01) { ctx.fillStyle = 'rgba(255,255,255,.55)'; ctx.fillRect(X_BAR + W_BAR * Math.min(1, c.peak) - 1, cy - 4.5, 1.5, 9); }
      // 音域地圖：x=音高（12..120）、held=亮點+外圈、其餘按新舊淡出、大小=力度
      ctx.fillStyle = 'rgba(255,255,255,.04)'; ctx.fillRect(X_STRIP, cy, W_STRIP, 1);
      for (const d of c.dots) {
        const age = now - d.t, heldNow = c.held.has(d.p);
        const a = heldNow ? 0.95 : Math.max(0, 1 - age / this.dotLife);
        if (a <= 0.02) continue;
        const x = X_STRIP + W_STRIP * Math.min(1, Math.max(0, (d.p - NOTE_MIN) / (NOTE_MAX - NOTE_MIN)));
        const r = 1.2 + d.v * 2.6;
        ctx.globalAlpha = a; ctx.fillStyle = col;
        ctx.beginPath(); ctx.arc(x, cy, r, 0, 6.2832); ctx.fill();
        if (heldNow) { ctx.strokeStyle = col; ctx.lineWidth = 0.8; ctx.beginPath(); ctx.arc(x, cy, r + 2, 0, 6.2832); ctx.stroke(); }
        ctx.globalAlpha = 1;
      }
      // 右緣：rate + held 數
      ctx.font = '8.5px monospace'; ctx.textAlign = 'right';
      ctx.fillStyle = c.rate ? '#8fa3bd' : '#3a4454';
      ctx.fillText(c.rate ? `${c.rate}/s` : '·', X_RATE + 34, cy - (c.held.size ? 4 : 0));
      if (c.held.size) { ctx.fillStyle = col; ctx.fillText(`⏵${c.held.size}`, X_RATE + 34, cy + 5); }
      ctx.textAlign = 'left';
    }
    // ch16 CC lane（有看過的 CC 才畫；聽覺透視 CC10-12 / 世界狀態 CC1-9）
    const c16 = this.ch[15], ccs = [...c16.cc.entries()].filter(([n]) => n >= 1 && n <= 19).sort((a, b) => a[0] - b[0]);
    if (ccs.length) {
      const y = HEAD + 16 * rowH + 3, bw = 26;
      ctx.font = '8px monospace';
      ccs.slice(0, 12).forEach(([n, o], i) => {
        const x = X_LBL + 34 + i * (bw + 6), age = now - o.t, a = Math.max(0.25, 1 - age / 6);
        ctx.fillStyle = '#56708c'; ctx.fillText(`c${n}`, x, y + 7);
        ctx.fillStyle = 'rgba(255,255,255,.06)'; ctx.fillRect(x + 14, y + 3, bw - 14, 8);
        ctx.globalAlpha = a; ctx.fillStyle = n >= 10 && n <= 12 ? '#ffd27f' : '#9cd2ff';
        ctx.fillRect(x + 14, y + 3, (bw - 14) * o.v, 8); ctx.globalAlpha = 1;
      });
      ctx.fillStyle = '#56708c'; ctx.fillText('CC', X_LBL, y + 7);
    }
  }
}
