// @openav/drums — the drum department: a synth kit, a step sequencer, and pads.
//
// Three pieces, one design rule: the sequencer publishes drum/* signals in the
// SAME SHAPE the audio analyzer publishes them (drum/kick pulse + drum/kick/env
// continuous). A world mapped to a kick cannot tell whether it came from a real
// bass drum through the mic (audio/kick) or from this machine (drum/kick) —
// which is exactly what a simulator is for.
//
//   drumEngine()     L4 sound engine (same contract as toneEngine): GM drum
//                    notes in, synthesized drums out — kick 36 · snare 38 ·
//                    clap 39 · closed hat 42 · open hat 46 · tom 45.
//                    Pure WebAudio synthesis, zero samples, zero dependencies;
//                    pass {samples:{36:'kick.wav',…}} to go sampler-style.
//   DrumSequencer    16-step × 4-track pattern clock with presets, swing and
//                    humanize — the drum sibling of the keys SimPlayer.
//   mountDrums       UI: TR-style step grid + transport + pattern/bpm/swing.
//
// Sequencer hits travel the standard road: midi/note/on (ch 10, GM notes) +
// drum/<name> pulses + drum/<name>/env envelopes → engine, worlds, meters and
// the mapper all hear them with zero new concepts. A MIDI drum pad hitting
// note 36 lands in exactly the same lanes.

export const GM = { kick: 36, snare: 38, clap: 39, tom: 45, hat: 42, openhat: 46 };
const LANES = ['kick', 'snare', 'hat', 'clap'];

/** Synthesized drum kit — engine contract: enable/noteOn/noteOff/set/params. */
export function drumEngine({ samples = null } = {}) {
  let ctx = null, out = null, buffers = {};
  const noiseBuf = () => {
    const b = ctx.createBuffer(1, ctx.sampleRate * 0.5, ctx.sampleRate);
    const d = b.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return b;
  };
  let noise = null;
  const env = (g, t0, a, peak, dec) => {
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(peak, t0 + a);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + a + dec);
  };
  const play = {
    kick(vel, t) {                          // sine sweep 150→45Hz + click
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.frequency.setValueAtTime(150, t);
      o.frequency.exponentialRampToValueAtTime(45, t + 0.12);
      env(g, t, 0.002, vel, 0.28);
      o.connect(g).connect(out); o.start(t); o.stop(t + 0.4);
    },
    snare(vel, t) {                         // noise burst + 190Hz body
      const n = ctx.createBufferSource(); n.buffer = noise;
      const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 1200;
      const ng = ctx.createGain(); env(ng, t, 0.001, vel * 0.8, 0.16);
      n.connect(hp).connect(ng).connect(out); n.start(t); n.stop(t + 0.25);
      const o = ctx.createOscillator(); o.type = 'triangle'; o.frequency.value = 190;
      const g = ctx.createGain(); env(g, t, 0.001, vel * 0.5, 0.09);
      o.connect(g).connect(out); o.start(t); o.stop(t + 0.15);
    },
    hat(vel, t, open = false) {             // high-passed noise, short/long
      const n = ctx.createBufferSource(); n.buffer = noise;
      const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 7000;
      const g = ctx.createGain(); env(g, t, 0.001, vel * 0.5, open ? 0.35 : 0.05);
      n.connect(hp).connect(g).connect(out); n.start(t); n.stop(t + (open ? 0.45 : 0.1));
    },
    clap(vel, t) {                          // three short bursts
      for (let i = 0; i < 3; i++) {
        const n = ctx.createBufferSource(); n.buffer = noise;
        const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1500; bp.Q.value = 1.5;
        const g = ctx.createGain(); env(g, t + i * 0.012, 0.001, vel * 0.55, 0.1);
        n.connect(bp).connect(g).connect(out); n.start(t + i * 0.012); n.stop(t + i * 0.012 + 0.18);
      }
    },
    tom(vel, t) {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.frequency.setValueAtTime(160, t);
      o.frequency.exponentialRampToValueAtTime(80, t + 0.2);
      env(g, t, 0.002, vel * 0.8, 0.3);
      o.connect(g).connect(out); o.start(t); o.stop(t + 0.45);
    },
  };
  const BY_NOTE = { 36: 'kick', 35: 'kick', 38: 'snare', 40: 'snare', 39: 'clap',
    42: 'hat', 44: 'hat', 46: 'openhat', 45: 'tom', 41: 'tom', 47: 'tom', 48: 'tom' };
  return {
    params: [{ key: 'kitVolume', label: 'Kit volume (dB)', min: -30, max: 0, def: -6 }],
    async enable() {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      out = ctx.createGain(); out.gain.value = 0.5; out.connect(ctx.destination);
      noise = noiseBuf();
      if (samples) {
        for (const [note, url] of Object.entries(samples)) {
          try { buffers[note] = await ctx.decodeAudioData(await (await fetch(url)).arrayBuffer()); } catch (e) {}
        }
      }
    },
    noteOn(note, vel01 = 0.8) {
      if (!ctx) return;
      if (ctx.state === 'suspended') ctx.resume();
      const t = ctx.currentTime;
      if (buffers[note]) {                  // sampler path
        const s = ctx.createBufferSource(); s.buffer = buffers[note];
        const g = ctx.createGain(); g.gain.value = vel01;
        s.connect(g).connect(out); s.start(t);
        return;
      }
      const name = BY_NOTE[note];
      if (name === 'openhat') play.hat(vel01, t, true);
      else if (play[name]) play[name](vel01, t);
    },
    noteOff() {},
    set(key, value) { if (key === 'kitVolume' && out) out.gain.value = Math.pow(10, value / 20); },
    dispose() { try { ctx?.close(); } catch (e) {} ctx = null; },
  };
}

export const PATTERNS = {
  'four on floor': {
    kick:  '1000100010001000', snare: '0000100000001000',
    hat:   '1010101010101010', clap:  '0000000000000000',
  },
  breakbeat: {
    kick:  '1000000110100000', snare: '0000100000001001',
    hat:   '1010101010101010', clap:  '0000100000000000',
  },
  'half time': {
    kick:  '1000000000001000', snare: '0000000010000000',
    hat:   '1010101010101010', clap:  '0000000010000000',
  },
  latin: {
    kick:  '1000001000100000', snare: '0010010000100100',
    hat:   '1011101110111011', clap:  '0000000000000000',
  },
  sparse: {
    kick:  '1000000000100000', snare: '0000000000000000',
    hat:   '0010001000100010', clap:  '0000000010000000',
  },
};

/** 16-step × 4-lane pattern clock. Pure logic — unit-testable with a fake emitter.
 *  update(dt) fires hits through onHit(lane, velocity); swing shifts every other
 *  16th, humanize jitters timing and velocity so it grooves, not ticks. */
export class DrumSequencer {
  constructor({ onHit, bpm = 112, swing = 0.12, humanize = 0.35, pattern = 'four on floor' } = {}) {
    this.onHit = onHit || (() => {});
    this.bpm = bpm; this.swing = swing; this.humanize = humanize;
    this.grid = {};                        // lane -> [0|1] × 16
    this.setPattern(pattern);
    this.playing = false;
    this._t = 0; this._nextStep = 0; this._step = 0;
  }
  setPattern(name) {
    const p = PATTERNS[name] || PATTERNS['four on floor'];
    for (const lane of LANES) this.grid[lane] = (p[lane] || '0'.repeat(16)).split('').map(Number);
    this.pattern = name;
  }
  toggleCell(lane, i) { this.grid[lane][i] = this.grid[lane][i] ? 0 : 1; this.pattern = 'custom'; }
  toggle(on = !this.playing) {
    this.playing = on;
    if (on) { this._t = 0; this._nextStep = 0; this._step = 0; }
    return on;
  }
  stepDur() { return 60 / this.bpm / 4; }   // 16ths
  update(dt) {
    if (!this.playing) return;
    this._t += dt;
    while (this._t >= this._nextStep) {
      const i = this._step % 16;
      for (const lane of LANES) {
        if (!this.grid[lane][i]) continue;
        const late = this.humanize * (Math.random() - 0.3) * 0.02;
        const vel = Math.max(0.15, Math.min(1,
          (i % 4 === 0 ? 0.9 : 0.6) + this.humanize * (Math.random() - 0.5) * 0.5));
        // negative jitter can't rewind a fired step — clamp to "now"
        this._pending = this._pending || [];
        this._pending.push({ lane, vel, at: this._t + Math.max(0, late) });
      }
      const swingShift = (this._step % 2 === 1) ? this.swing * this.stepDur() : 0;
      this._step++;
      this._nextStep += this.stepDur() + swingShift - ((this._step % 2 === 1) ? 0 : this.swing * this.stepDur());
    }
    if (this._pending) {
      const due = this._pending.filter(p => p.at <= this._t);
      this._pending = this._pending.filter(p => p.at > this._t);
      for (const p of due) this.onHit(p.lane, p.vel);
    }
  }
}

const CSS = `
.oav-drums { font: 11px ui-monospace, monospace; color: #8892a8; }
.oav-drums .bar { display: flex; gap: 8px; align-items: center; margin-bottom: 6px; flex-wrap: wrap; }
.oav-drums select, .oav-drums input[type=range] { accent-color: #2e6df6; background: #1a2030;
  color: #cfd6e4; border: 1px solid #2a3348; border-radius: 6px; font: inherit; }
.oav-drums .grid { display: grid; grid-template-columns: 44px repeat(16, 1fr); gap: 2px; }
.oav-drums .lane-lbl { color: #667; align-self: center; }
.oav-drums .cell { aspect-ratio: 1; background: #131826; border: 1px solid #1c2334; border-radius: 3px;
  cursor: pointer; min-width: 10px; }
.oav-drums .cell.on { background: #2e6df6; }
.oav-drums .cell.beat { border-color: #2a3348; }
.oav-drums .cell.now { outline: 1px solid #ffd166; }
`;

/** mountDrums — TR-style grid + transport, publishing standard signals.
 *  Returns { seq, engine, update(dt), dispose }. */
export function mountDrums(container, { signals, engine = null, autoEnableEngine = true } = {}) {
  if (!document.getElementById('openav-drums-css')) {
    const st = document.createElement('style');
    st.id = 'openav-drums-css';
    st.textContent = CSS;
    document.head.appendChild(st);
  }
  const root = document.createElement('div');
  root.className = 'oav-drums';
  root.innerHTML = `
    <div class="bar">
      <label style="cursor:pointer"><input type="checkbox" data-play> drum machine</label>
      <select data-pattern>${Object.keys(PATTERNS).map(p => `<option>${p}</option>`).join('')}</select>
      <label>bpm <input type="range" data-bpm min="60" max="180" value="112" style="width:70px"></label>
      <span data-bpmv>112</span>
    </div>
    <div class="grid"></div>`;
  container.appendChild(root);

  const kit = engine || drumEngine();
  let kitReady = false;
  const envs = { kick: 0, snare: 0, hat: 0, clap: 0 };
  if (signals) {
    for (const l of LANES) {
      signals.define(`drum/${l}`, { kind: 'pulse', source: 'drums' });
      signals.define(`drum/${l}/env`, { source: 'drums' });
    }
  }

  const seq = new DrumSequencer({
    onHit: async (lane, vel) => {
      if (!kitReady && autoEnableEngine) { kitReady = true; await kit.enable(); }
      kit.noteOn(GM[lane], vel);
      envs[lane] = Math.min(1, 0.4 + vel);
      // same lanes a mic'd drummer would fill (audio/*) — simulator contract
      signals?.pulse(`drum/${lane}`, { level: vel });
      signals?.pulse('midi/note/on', { note: GM[lane], vel, ch: 10 });
    },
  });

  // grid UI
  const grid = root.querySelector('.grid');
  const cells = {};
  const buildGrid = () => {
    grid.innerHTML = '';
    for (const lane of LANES) {
      grid.appendChild(Object.assign(document.createElement('div'), { className: 'lane-lbl', textContent: lane }));
      cells[lane] = [];
      for (let i = 0; i < 16; i++) {
        const c = document.createElement('div');
        c.className = 'cell' + (i % 4 === 0 ? ' beat' : '') + (seq.grid[lane][i] ? ' on' : '');
        c.addEventListener('click', () => { seq.toggleCell(lane, i); c.classList.toggle('on'); });
        grid.appendChild(c);
        cells[lane].push(c);
      }
    }
  };
  buildGrid();

  root.querySelector('[data-play]').addEventListener('change', (e) => seq.toggle(e.target.checked));
  root.querySelector('[data-pattern]').addEventListener('change', (e) => { seq.setPattern(e.target.value); buildGrid(); });
  const bpmEl = root.querySelector('[data-bpm]');
  bpmEl.addEventListener('input', () => { seq.bpm = Number(bpmEl.value); root.querySelector('[data-bpmv]').textContent = bpmEl.value; });

  let lastStep = -1;
  return {
    seq,
    engine: kit,
    update(dt) {
      seq.update(dt);
      for (const l of LANES) {
        envs[l] *= Math.exp(-dt / 0.12);
        signals?.set(`drum/${l}/env`, envs[l]);
      }
      const cur = seq.playing ? (seq._step + 15) % 16 : -1;
      if (cur !== lastStep) {
        for (const lane of LANES) for (let i = 0; i < 16; i++) cells[lane][i].classList.toggle('now', i === cur);
        lastStep = cur;
      }
    },
    dispose() { seq.toggle(false); kit.dispose?.(); root.remove(); },
  };
}
