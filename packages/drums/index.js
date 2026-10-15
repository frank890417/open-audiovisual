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

export const GM = { kick: 36, rim: 37, snare: 38, clap: 39, lowtom: 41, hat: 42, pedalhat: 44, tom: 45, openhat: 46, hightom: 48, crash: 49, ride: 51, cowbell: 56 };

// General MIDI drum notes → kit voice. Pads and drum machines send these on channel 10; anything
// unlisted stays silent rather than guessing (a wrong cymbal on a kick pad is worse than nothing).
const BY_NOTE = {
  35: 'kick', 36: 'kick', 37: 'rim', 38: 'snare', 40: 'snare', 39: 'clap',
  41: 'lowtom', 43: 'lowtom', 45: 'tom', 47: 'tom', 48: 'hightom', 50: 'hightom',
  42: 'hat', 44: 'pedalhat', 46: 'openhat',
  49: 'crash', 52: 'crash', 55: 'crash', 57: 'crash', 51: 'ride', 53: 'ride', 59: 'ride', 56: 'cowbell',
};
/** The kit voice a GM drum note plays, or null. */
export function voiceForNote(note) { return BY_NOTE[note] ?? null; }
const LANES = ['kick', 'snare', 'hat', 'clap'];

/** Synthesized drum kit — engine contract: enable/noteOn/noteOff/set/params. */
export function drumEngine({ samples = null } = {}) {
  let ctx = null, out = null, buffers = {};
  let dst = null;                          // where the voice being built goes: its own gain while noteOn() builds it, so it can be cancelled
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
      o.connect(g).connect(dst); o.start(t); o.stop(t + 0.4);
    },
    snare(vel, t) {                         // noise burst + 190Hz body
      const n = ctx.createBufferSource(); n.buffer = noise;
      const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 1200;
      const ng = ctx.createGain(); env(ng, t, 0.001, vel * 0.8, 0.16);
      n.connect(hp).connect(ng).connect(dst); n.start(t); n.stop(t + 0.25);
      const o = ctx.createOscillator(); o.type = 'triangle'; o.frequency.value = 190;
      const g = ctx.createGain(); env(g, t, 0.001, vel * 0.5, 0.09);
      o.connect(g).connect(dst); o.start(t); o.stop(t + 0.15);
    },
    hat(vel, t, open = false) {             // high-passed noise, short/long
      const n = ctx.createBufferSource(); n.buffer = noise;
      const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 7000;
      const g = ctx.createGain(); env(g, t, 0.001, vel * 0.5, open ? 0.35 : 0.05);
      n.connect(hp).connect(g).connect(dst); n.start(t); n.stop(t + (open ? 0.45 : 0.1));
    },
    clap(vel, t) {                          // three short bursts
      for (let i = 0; i < 3; i++) {
        const n = ctx.createBufferSource(); n.buffer = noise;
        const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1500; bp.Q.value = 1.5;
        const g = ctx.createGain(); env(g, t + i * 0.012, 0.001, vel * 0.55, 0.1);
        n.connect(bp).connect(g).connect(dst); n.start(t + i * 0.012); n.stop(t + i * 0.012 + 0.18);
      }
    },
    tom(vel, t, f0 = 160) {                 // pitch sweep down an octave; low/mid/high share the body
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.frequency.setValueAtTime(f0, t);
      o.frequency.exponentialRampToValueAtTime(f0 / 2, t + 0.2);
      env(g, t, 0.002, vel * 0.8, 0.3 + (160 - f0) / 400);
      o.connect(g).connect(dst); o.start(t); o.stop(t + 0.6);
    },
    lowtom(vel, t) { play.tom(vel, t, 105); },
    hightom(vel, t) { play.tom(vel, t, 230); },
    pedalhat(vel, t) {                      // the foot closing the hats: shorter and duller than a stick hit
      const n = ctx.createBufferSource(); n.buffer = noise;
      const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 5500;
      const g = ctx.createGain(); env(g, t, 0.002, vel * 0.35, 0.03);
      n.connect(hp).connect(g).connect(dst); n.start(t); n.stop(t + 0.06);
    },
    metal(vel, t, dec, hpHz, level) {       // six detuned squares (the 808 cymbal recipe) through a high-pass
      const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = hpHz;
      const g = ctx.createGain(); env(g, t, 0.001, vel * level, dec);
      hp.connect(g).connect(dst);
      for (const f of [205.3, 304.4, 369.6, 522.7, 540, 800]) {
        const o = ctx.createOscillator(); o.type = 'square'; o.frequency.value = f * 1.6;
        o.connect(hp); o.start(t); o.stop(t + dec + 0.1);
      }
    },
    crash(vel, t) {                         // metal + a wash of noise, long tail
      play.metal(vel, t, 1.6, 6500, 0.22);
      const n = ctx.createBufferSource(); n.buffer = noise; n.loop = true;
      const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 4500;
      const g = ctx.createGain(); env(g, t, 0.003, vel * 0.35, 1.4);
      n.connect(hp).connect(g).connect(dst); n.start(t); n.stop(t + 1.6);
    },
    ride(vel, t) { play.metal(vel, t, 0.8, 8000, 0.18); },
    rim(vel, t) {                           // a click and a short wooden ping
      const o = ctx.createOscillator(); o.type = 'triangle'; o.frequency.value = 1700;
      const g = ctx.createGain(); env(g, t, 0.0005, vel * 0.5, 0.03);
      o.connect(g).connect(dst); o.start(t); o.stop(t + 0.06);
    },
    cowbell(vel, t) {
      const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 800; bp.Q.value = 2;
      const g = ctx.createGain(); env(g, t, 0.001, vel * 0.4, 0.25);
      bp.connect(g).connect(dst);
      for (const f of [540, 800]) { const o = ctx.createOscillator(); o.type = 'square'; o.frequency.value = f; o.connect(bp); o.start(t); o.stop(t + 0.3); }
    },
  };
  return {
    params: [{ key: 'kitVolume', label: 'Kit volume (dB)', min: -30, max: 0, def: -6 }],
    /** the kit's AudioContext once enabled (null before): a page resumes it from a click when the browser held it back */
    get context() { return ctx; },
    /** the kit's output node (null before enable): it goes to the speakers; a recorder taps it here too */
    get output() { return out; },
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
    /** noteOn(note, velocity, time): time is on the kit's AudioContext clock (engine.context.currentTime); left out, or
     *  already past, the hit sounds now. Returns { time, cancel() } (cancel() silences a hit that has not started yet:
     *  the drum machine's lookahead takes back what it scheduled when the pattern or the tempo changes), or null. */
    noteOn(note, vel01 = 0.8, time) {
      if (!ctx) return null;
      if (ctx.state === 'suspended') ctx.resume();
      const t = time != null && time > ctx.currentTime ? time : ctx.currentTime;
      const name = buffers[note] ? null : voiceForNote(note);
      if (!buffers[note] && !(name && (play[name] || name === 'openhat'))) return null;
      const voice = ctx.createGain(); voice.connect(out);
      dst = voice;
      try {
        if (buffers[note]) {                // sampler path
          const s = ctx.createBufferSource(); s.buffer = buffers[note];
          const g = ctx.createGain(); g.gain.value = vel01;
          s.connect(g).connect(dst); s.start(t);
        } else if (name === 'openhat') play.hat(vel01, t, true);
        else play[name](vel01, t);
      } finally { dst = out; }
      return { time: t, cancel() { try { voice.disconnect(); } catch (e) { /* gone already */ } } };
    },
    /** Play a voice by name ('kick', 'crash'…) or GM note number — for code that is not a MIDI pad. */
    hit(what, vel01 = 0.9, time) { const note = typeof what === 'number' ? what : GM[what]; return note != null ? this.noteOn(note, vel01, time) : null; },
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

/** A lane written as text or a list → 16 steps of 0/1. 'x... x... x... x...' and '1000100010001000' are the
 *  same four-on-the-floor kick ('x', 'X', '1' are hits; spaces and '|' only help the eye); [1, 0, true, …] works too.
 *  Short lanes are padded with rests, long ones cut at 16. */
export function laneSteps(v) {
  const src = Array.isArray(v) ? v : String(v ?? '').replace(/[\s|]/g, '').split('');
  const out = [];
  for (let i = 0; i < 16; i++) { const c = src[i]; out.push(c === true || c === 1 || c === '1' || c === 'x' || c === 'X' ? 1 : 0); }
  return out;
}

/** 16-step × 4-lane pattern clock. Pure logic — unit-testable with a fake emitter.
 *  update(dt) fires hits through onHit(lane, velocity) and every step through
 *  onStep(index 0..15, count since start); swing shifts every other 16th,
 *  humanize jitters timing and velocity so it grooves, not ticks. */
export class DrumSequencer {
  constructor({ onHit, onStep = null, bpm = 112, swing = 0.12, humanize = 0.35, pattern = 'four on floor' } = {}) {
    this.onHit = onHit || (() => {});
    this.onStep = onStep;                  // the clock itself: a piece that counts bars or fires cues listens here
    this.bpm = bpm; this.swing = swing; this.humanize = humanize;
    this.grid = {};                        // lane -> [0|1] × 16
    this.setPattern(pattern);
    this.playing = false;
    this._t = 0; this._nextStep = 0; this._step = 0;
  }
  /** A preset name ('breakbeat'), or your own grid { kick: 'x...x...x...x...', snare: …, hat: …, clap: … } (= 'custom';
   *  a lane left out is silent). An unknown name plays 'four on floor' and says so in `pattern`. */
  setPattern(p) {
    if (p && typeof p === 'object') {
      for (const lane of LANES) this.grid[lane] = laneSteps(p[lane]);
      this.pattern = 'custom';
      return;
    }
    const name = PATTERNS[p] ? p : 'four on floor';
    for (const lane of LANES) this.grid[lane] = laneSteps(PATTERNS[name][lane]);
    this.pattern = name;
  }
  toggleCell(lane, i) { this.grid[lane][i] = this.grid[lane][i] ? 0 : 1; this.pattern = 'custom'; }
  toggle(on = !this.playing) {
    this.playing = on;
    if (on) { this._t = 0; this._nextStep = 0; this._step = 0; }
    this._pending = null;                    // a hit humanized past the stop never lands on the next start
    return on;
  }
  stepDur() { return 60 / this.bpm / 4; }   // 16ths
  update(dt) {
    if (!this.playing) return;
    this._t += dt;
    while (this._t >= this._nextStep) {
      const i = this._step % 16;
      if (this.onStep) this.onStep(i, this._step);
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

// ---------------------------------------------------------------- the lookahead clock (0.6)
// A hit played "in the frame it is due" is late by up to a frame: 17 ms at 60 fps, 50 ms when a heavy sketch drops to
// 20 fps, against a 16th that lasts 136 ms at 110 bpm, so the groove limps. A hidden tab runs no frames at all, so the
// drums stopped. The cure is the one Chris Wilson's "A tale of two clocks" teaches (web.dev/articles/audio-scheduling): a
// timer wakes up often (from a Web Worker, which a hidden tab does not throttle), looks a little ahead on the AUDIO clock,
// and gives Web Audio every hit in that window with its exact start time. The picture is told separately, in the frame
// each hit is heard. (The W3C Web Audio spec for currentTime, getOutputTimestamp() and outputLatency is the other source.)
//
//   DrumScheduler  pure logic, no timers, no audio: a grid or a compiled rhythm → timed events. Positions count bars from
//                  the start (0 = the downbeat of bar 1, 1.5 = halfway through bar 2) and become seconds by multiplication
//                  from the last tempo anchor, never by adding up frame times: a thousand bars later nothing has drifted.
//   DrumTransport  the runtime around it: the heartbeat, the two clocks (performance.now() until the kit's AudioContext
//                  runs, that context's clock after), hits handed to the kit ahead of time, the page told when each is heard.

const STEPS = 16;                          // the clock's grid: 16ths, 16 steps a bar, as the machine always counted
const RANK = Object.fromEntries(Object.keys(GM).map((v, i) => [v, i]));
const LANE_SET = new Set(LANES);
/** on a beat (the grid machine's accent, 0.9) or between (0.6) */
const accent = (p) => (Math.abs(p * 4 - Math.round(p * 4)) < 1e-7 ? 0.9 : 0.6);
/** in time; at one time the step before its hits, then the order they were made in */
const order = (a, b) => a.time - b.time || a.k - b.k || a.seq - b.seq;

/** Grid or rhythm → timed events, ahead of time. Every time is passed in (seconds on any one clock), so it runs the same
 *  under a fake clock in a test as under the audio clock in a page.
 *    start(t) · stop() → dropped · advance(now) → the events of [scheduled so far, now + lookahead) · due(t) → those heard
 *    by t, in order · rewind(t) → takes back what was scheduled from t on (the next advance makes it again) · setBpm(bpm, t)
 *    · posAt(t) / timeAt(pos) / phaseAt(t) · setPattern(p, { text }) · toggleCell · gridOf(bar) · takeover(bar) · barEvents(bar)
 *  Events: { kind: 'step', i 0..15, n (steps since the start), bar, pos, time } and { kind: 'hit', voice, vel, pos, n, bar,
 *  token, word, layer, time }. */
export class DrumScheduler {
  constructor({ bpm = 112, swing = 0, humanize = 0.35, lookahead = 0.1, pattern = 'four on floor', seed = 0, random = Math.random } = {}) {
    this._bpm = +bpm > 0 ? +bpm : 112;
    this.swing = swing;                    // 0..0.5: every odd 16th that much of a 16th late (0: straight, as the machine always played)
    this.humanize = humanize;              // 0..1: a few ms late and a little softer or louder, so it grooves instead of ticking
    this.lookahead = lookahead;            // seconds handed to the kit ahead of time
    this.seed = seed; this.random = random;
    this.grid = {}; this.mode = 'grid'; this.source = null; this.text = ''; this.pattern = 'four on floor';
    this.playing = false; this.queue = []; this.warning = null; this.skipped = 0;
    this._tempo = []; this._to = 0; this._seq = 0; this._cache = new Map(); this._now = null;
    this.setPattern(pattern);
  }
  get bpm() { return this._bpm; }
  set bpm(v) { this.setBpm(v); }
  stepDur() { return 60 / this._bpm / 4; }

  /** A preset name, your own grid { kick: 'x...x...', … }, or a compiled rhythm (anything with eventsInBar(bar, { seed }),
   *  i.e. @openav/pattern's compile(text)); { text } is the line it came from. An unknown name plays 'four on floor'. */
  setPattern(p, { text } = {}) {
    this._cache.clear();
    if (p && typeof p.eventsInBar === 'function') {
      this.mode = 'string'; this.source = p; this.text = String(text ?? p.text ?? '');
      this.pattern = this.text || 'rhythm';
      this.grid = this.gridOf(1).grid;     // what bar 1 looks like on the four lanes, for code that reads `grid`
      return this.pattern;
    }
    this.mode = 'grid'; this.source = null; this.text = '';
    if (p && typeof p === 'object') {
      for (const lane of LANES) this.grid[lane] = laneSteps(p[lane]);
      this.pattern = 'custom';
      return this.pattern;
    }
    const name = PATTERNS[p] ? p : 'four on floor';
    for (const lane of LANES) this.grid[lane] = laneSteps(PATTERNS[name][lane]);
    this.pattern = name;
    return name;
  }
  toggleCell(lane, i) {
    if (this.mode !== 'grid') this.takeover(1);
    this.grid[lane][i] = this.grid[lane][i] ? 0 : 1;
    this.pattern = 'custom'; this._cache.clear();
  }
  /** bar `bar` of what plays, on the 16 steps of the four lanes: { grid, offGrid (hits moved to the nearest step),
   *  dropped (voices the grid has no lane for) } */
  gridOf(bar = 1) {
    const grid = {}, dropped = new Set();
    let offGrid = 0;
    for (const lane of LANES) grid[lane] = Array(STEPS).fill(0);
    for (const e of this.barEvents(bar)) {
      if (!grid[e.voice]) { dropped.add(e.voice); continue; }
      const x = e.pos * STEPS, r = Math.round(x);
      if (Math.abs(x - r) > 1e-6) offGrid++;
      grid[e.voice][Math.min(STEPS - 1, r)] = 1;
    }
    return { grid, offGrid, dropped: [...dropped].sort((a, b) => RANK[a] - RANK[b]) };
  }
  /** the rhythm string becomes the grid it plays in `bar` (a click on a cell: the cells take over) */
  takeover(bar = 1) {
    const r = this.gridOf(bar);
    this.mode = 'grid'; this.source = null; this.text = ''; this.grid = r.grid; this.pattern = 'custom'; this._cache.clear();
    return r;
  }
  /** the hits of bar `bar` (1 = the first): [{ voice, pos 0..1, vel?, token?, word?, layer? }], whichever the source */
  barEvents(bar) {
    const got = this._cache.get(bar);
    if (got) return got;
    const evs = [];
    if (this.mode === 'string') {
      let raw = [];
      try { raw = this.source.eventsInBar(bar, { seed: this.seed }) || []; } catch (e) { this.warning = `eventsInBar(${bar}): ${e && e.message}`; }
      for (const e of raw) {
        if (!e || !(e.pos >= 0 && e.pos < 1)) continue;
        if (GM[e.voice] == null) { this.warning = `no drum "${e && e.voice}"`; continue; }
        evs.push(e);
      }
    } else {
      for (const lane of LANES) for (let i = 0; i < STEPS; i++) if (this.grid[lane] && this.grid[lane][i]) evs.push({ voice: lane, pos: i / STEPS });
    }
    if (this._cache.size > 32) this._cache.clear();
    this._cache.set(bar, evs);
    return evs;
  }

  // ---- the tempo map: anchors { time, pos, bpm }; a tempo change adds one, so the past keeps the tempo it had
  _anchor(t) { const a = this._tempo; let k = a.length - 1; while (k > 0 && a[k].time > t) k--; return a[k]; }
  _anchorAtPos(p) { const a = this._tempo; let k = a.length - 1; while (k > 0 && a[k].pos > p) k--; return a[k]; }
  /** where the music is at time t, in bars from the start (bar 1's downbeat = 0; negative before it) */
  posAt(t) { const a = this._anchor(t); return a ? a.pos + (t - a.time) * a.bpm / 240 : 0; }
  /** when position p sounds (before swing and humanize) */
  timeAt(p) { const a = this._anchorAtPos(p); return a ? a.time + (p - a.pos) * 240 / a.bpm : 0; }
  bpmAt(t) { const a = this._anchor(t); return a ? a.bpm : this._bpm; }
  /** { pos, bar 0..1 through the bar, beat 0..1 through the beat } at time t (0 before the first downbeat) */
  phaseAt(t) { const pos = Math.max(0, this.posAt(t)); return { pos, bar: pos - Math.floor(pos), beat: pos * 4 - Math.floor(pos * 4) }; }

  start(at) { this.playing = true; this._tempo = [{ time: at, pos: 0, bpm: this._bpm }]; this._to = 0; this.queue = []; this._now = at; return this; }
  /** stop: what was scheduled and not yet heard (to take back from the kit) */
  stop() { this.playing = false; const q = this.queue; this.queue = []; return q; }
  /** the tempo from time `at` on (left out: from the end of what is already scheduled, so nothing is taken back) → dropped */
  setBpm(bpm, at) {
    bpm = +bpm;
    if (!(bpm > 0)) return [];
    this._bpm = bpm;
    if (!this.playing || !this._tempo.length) return [];
    if (at == null) at = this.timeAt(this._to);
    const first = this._tempo[0];
    if (at <= first.time) { const d = this.rewind(at); this._tempo = [{ time: first.time, pos: first.pos, bpm }]; return d; }
    const dropped = this.rewind(at), pos = this.posAt(at);
    this._tempo = this._tempo.filter((a) => a.time < at);
    this._tempo.push({ time: at, pos, bpm });
    return dropped;
  }
  /** take back everything scheduled at or after time `at` (the next advance makes it again, from the pattern and the
   *  tempo as they are then) → the events taken back. Delivered events are never taken back: they were heard before `at`. */
  rewind(at) {
    if (!this.playing) return [];
    const cut = this.posAt(at);
    if (!(cut < this._to)) return [];
    const keep = [], dropped = [];
    for (const ev of this.queue) (ev.pos >= cut ? dropped : keep).push(ev);
    this.queue = keep; this._to = cut;
    return dropped;
  }
  /** schedule up to now + lookahead → the new events, in order (they are in `queue` too, until due() hands them out) */
  advance(now) {
    if (!this.playing) return [];
    this._now = now;
    const a = this._tempo;
    while (a.length > 1 && a[1].time < now - 4) a.shift();   // a few seconds of tempo history: the page asks about the heard past
    let from = this._to;
    const to = this.posAt(now + this.lookahead);
    if (!(to > from)) return [];
    if (to - from > 64) { this.skipped += Math.floor(to - 1) - Math.floor(from); from = Math.floor(to - 1); }   // a frozen page: not minutes of hits at once
    this._to = to;
    const out = [];
    for (let n = Math.max(0, Math.floor(from * STEPS)); n / STEPS < to; n++) {
      const pos = n / STEPS;
      if (pos < from) continue;
      out.push({ kind: 'step', k: 0, seq: this._seq++, i: n % STEPS, n, bar: Math.floor(n / STEPS) + 1, pos, time: this._at(pos) });
    }
    for (let b = Math.max(0, Math.floor(from)); b < to; b++) {
      for (const e of this.barEvents(b + 1)) {
        const pos = b + e.pos;
        if (pos < from || pos >= to) continue;
        const late = this.humanize * (this.random() - 0.3) * 0.02;     // a few ms behind, never ahead: as the grid machine leaned
        const base = accent(e.pos) * (e.vel == null ? 1 : Math.max(0, +e.vel || 0));
        const vel = Math.max(0.15, Math.min(1, base + this.humanize * (this.random() - 0.5) * 0.5));
        out.push({ kind: 'hit', k: 1, seq: this._seq++, voice: e.voice, vel, pos, n: Math.floor(pos * STEPS + 1e-7), bar: b + 1,
          token: e.token || null, word: e.word, layer: e.layer, dur: e.dur, time: this._at(pos) + Math.max(0, late) });
      }
    }
    out.sort(order);
    for (const ev of out) this.queue.push(ev);
    this.queue.sort(order);
    return out;
  }
  /** the events heard by time t, in order (removed from the queue) */
  due(t) { const q = this.queue; let k = 0; while (k < q.length && q[k].time <= t) k++; return k ? q.splice(0, k) : []; }
  _at(pos) {                               // swing: every odd 16th a little late, the way a drummer leans
    let t = this.timeAt(pos);
    if (this.swing) { const x = pos * STEPS, r = Math.round(x); if (Math.abs(x - r) < 1e-7 && r % 2 === 1) t += this.swing * 60 / this.bpmAt(t) / 4; }
    return t;
  }
}

const perfNow = () => (typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now()) / 1000;
const pageHidden = () => typeof document !== 'undefined' && document.visibilityState === 'hidden';

/** The runtime around a DrumScheduler: a heartbeat schedules ahead on the kit's audio clock, frames hear what is due.
 *    new DrumTransport({ scheduler, engine, onStep(i, n, ev), onHit(voice, vel, ev), heartbeat: 'auto' | 'interval' | false,
 *      tick: 0.025, latency: 'auto' | seconds, stale: 0.25, autoEnable, now, hidden })
 *    start() · stop() · toggle(on) · setPattern(p, { text }) · toggleCell(lane, i) · takeover(bar) · setBpm(bpm)
 *    pump() (the heartbeat: schedules; also tells the page while no frame runs) · frame() (once a frame: schedules, then
 *    tells the page what is heard by now) · times() → { sched, heard, live } · phase() → { bar, beat, pos } · info()
 *  The page hears each hit when it is heard (its scheduled time plus the output latency the browser reports). Hidden, or
 *  more than `stale` seconds late (a stalled frame loop catching up), a step is told quietly — ev.quiet: the clock moves
 *  (and cues fire) but no hits and no per-step callbacks are told, and of several bar starts at once only the last is
 *  announced (ev.announce) — so a tab that comes back is never flooded with what nobody saw. */
export class DrumTransport {
  constructor({ scheduler = new DrumScheduler(), engine = null, onStep = null, onHit = null, onLate = null, autoEnable = false,
    now = perfNow, hidden = pageHidden, heartbeat = 'auto', tick = 0.025, latency = 'auto', stale = 0.25, startDelay = 0.05 } = {}) {
    this.scheduler = scheduler; this.engine = engine; this.onStep = onStep; this.onHit = onHit; this.onLate = onLate;
    this.autoEnable = autoEnable; this._perf = now; this._hidden = hidden; this.tick = tick; this.latency = latency;
    this.stale = stale; this.startDelay = startDelay; this.heartbeatMode = heartbeat;
    this.heartbeat = 'none'; this.heartbeatWhy = ''; this.late = 0; this.extended = false; this.audio = false;
    this._clocked = !!engine && typeof engine === 'object' && 'context' in engine;   // an engine that shows its AudioContext is scheduled ahead
    this._live = false; this._wentLive = false; this._k = 0; this._off = 0; this._ct = -1; this._ctAt = 0;
    this._lastHeard = -Infinity; this._lastFrame = -Infinity; this._hb = null; this._phase = { pos: 0, bar: 0, beat: 0 }; this._lat = 0;
  }
  get playing() { return this.scheduler.playing; }
  get pattern() { return this.scheduler.pattern; }
  get grid() { return this.scheduler.grid; }
  get mode() { return this.scheduler.mode; }
  get text() { return this.scheduler.text; }
  get bpm() { return this.scheduler.bpm; }
  set bpm(v) { this.setBpm(v); }
  get swing() { return this.scheduler.swing; }
  set swing(v) { this.scheduler.swing = +v || 0; this.rewind(); }
  get humanize() { return this.scheduler.humanize; }
  set humanize(v) { this.scheduler.humanize = Math.max(0, +v || 0); this.rewind(); }
  get lookahead() { return this.scheduler.lookahead; }
  stepDur() { return this.scheduler.stepDur(); }

  /** { sched, heard, live }: `sched` is the earliest time a hit can still go to the kit, `heard` what the listener hears
   *  right now. One master time line in seconds: performance.now() until the kit's AudioContext runs, then that context's
   *  clock shifted so the heard time carries on without a jump (Web Audio is scheduled on its own clock, exactly). */
  times() {
    const p = this._perf(), ctx = this._clocked ? this.engine.context : null;
    let live = false, ct = 0;
    if (ctx && ctx.state === 'running') {
      ct = +ctx.currentTime || 0;
      if (ct !== this._ct) { this._ct = ct; this._ctAt = p; }
      live = ct > 0 && p - this._ctAt < 0.5;   // a context that stopped moving (no output device) is no clock
    }
    let sched, heard;
    if (live) {
      const h = this._heardCt(ctx, ct, p);
      if (!this._live) { this._k = Math.max(this._lastHeard, p + this._off) - h; this._live = true; this._wentLive = true; }
      sched = ct + this._k; heard = h + this._k;
    } else {
      if (this._live) { this._off = this._lastHeard - p; this._live = false; }   // the context stopped: carry on from what was heard
      sched = heard = p + this._off;
    }
    if (heard < this._lastHeard) heard = this._lastHeard;
    if (heard > sched) heard = sched;
    this._lastHeard = heard; this._lat = sched - heard; this.audio = live;
    return { sched, heard, live, ct };
  }
  _heardCt(ctx, ct, p) {
    if (typeof this.latency === 'number') return ct - this.latency;
    if (this._perf === perfNow) {
      try {                                // the context time leaving the speakers now (the browser's own estimate)
        const ts = typeof ctx.getOutputTimestamp === 'function' ? ctx.getOutputTimestamp() : null;
        if (ts && ts.contextTime > 0 && ts.performanceTime > 0) {
          const h = ts.contextTime + (p * 1000 - ts.performanceTime) / 1000;
          if (h > ct - 0.5 && h <= ct + 0.002) return Math.min(h, ct);
        }
      } catch (e) { /* not in this browser */ }
    }
    const l = +ctx.outputLatency || +ctx.baseLatency || 0;
    return ct - (l > 0 && l < 0.5 ? l : 0);
  }

  start() {
    const c = this.times();
    if (this._clocked && this.autoEnable && !this.engine.context && !this._enabling) {
      this._enabling = true;
      Promise.resolve().then(() => this.engine.enable()).then(null, () => { this._enabling = false; });
    }
    if (this.playing) this._cancel(this.scheduler.stop(), c);
    this.scheduler.start(c.sched + (c.live ? this.startDelay : 0));
    this._fill(c);
    this._beat();
    return true;
  }
  stop() {
    const c = this.times();
    this._cancel(this.scheduler.stop(), c);
    this._unbeat();
    return false;
  }
  /** on: start from bar 1 (again, if it was playing), as the grid's checkbox does; off: stop */
  toggle(on = !this.playing) { return on ? this.start() : this.stop(); }
  setPattern(p, o) { const r = this.scheduler.setPattern(p, o); this.rewind(); return r; }
  toggleCell(lane, i) { this.scheduler.toggleCell(lane, i); this.rewind(); }
  takeover(bar) { const r = this.scheduler.takeover(bar); this.rewind(); return r; }
  /** a new tempo from now on: what was scheduled after now is taken back and made again, so no hit doubles or goes missing */
  setBpm(v) {
    v = +v;
    if (!(v > 0) || v === this.bpm) return this.bpm;     // the same tempo again (a cue that calls startDrums()): nothing to redo
    if (!this.playing) { this.scheduler.setBpm(v); return v; }
    const c = this.times();
    this._cancel(this.scheduler.setBpm(v, c.sched + 0.01), c);
    this._fill(c);
    return v;
  }
  /** a change is heard at once: what was scheduled after now (10 ms of margin: never a hit already sounding) is made again */
  rewind() {
    if (!this.playing) return;
    const c = this.times();
    this._cancel(this.scheduler.rewind(c.sched + 0.01), c);
    this._fill(c);
  }
  /** the heartbeat: schedule ahead; and while no frame runs (a hidden tab, a sketch stuck for a moment) tell the page too */
  pump() {
    if (!this.playing) return;
    const c = this.times();
    this._fill(c);
    if (this._hidden() || this._perf() - this._lastFrame > 0.1) this._deliver(c);
  }
  /** once a frame (and right before p5 draws): schedule, then tell the page every step and hit heard by now → those events */
  frame() {
    this._lastFrame = this._perf();
    if (!this.playing) return [];
    const c = this.times();
    this._fill(c);
    return this._deliver(c);
  }
  /** where the listener is: { bar 0..1 through the bar, beat 0..1 through the beat, pos bars since the start }; it holds
   *  still while the machine is stopped */
  phase() {
    if (!this.playing) return this._phase;
    return (this._phase = this.scheduler.phaseAt(this.times().heard));
  }
  info() {
    return { clock: 'lookahead', heartbeat: this.heartbeat, why: this.heartbeatWhy, lookahead: this.scheduler.lookahead, late: this.late,
      extended: this.extended, audio: this.audio, latency: Math.round(this._lat * 1000) / 1000, skipped: this.scheduler.skipped, warning: this.scheduler.warning };
  }
  dispose() { this.stop(); }

  _fill(c) {
    const q = this.scheduler.queue;
    if (c.live && this._wentLive) {        // audio just came on: what is still ahead goes to the kit, what is past stays silent
      this._wentLive = false;
      for (const ev of q) if (ev.kind === 'hit' && !ev.sent) this._send(ev, c, true);
    }
    const evs = this.scheduler.advance(c.sched);
    if (!c.live) return evs;
    let worst = Infinity;                  // made after its time: the page held the thread longer than the lookahead
    for (const ev of evs) { worst = Math.min(worst, ev.time - c.sched); if (ev.kind === 'hit') this._send(ev, c, false); }
    if (worst < 0.005) this._lateOne(worst);
    return evs;
  }
  _send(ev, c, catchUp) {
    ev.sent = true;
    const at = ev.time - this._k, margin = at - c.ct;
    if (catchUp ? margin < 0 : margin < -0.05) { ev.skipped = true; return; }   // past: never a late burst, never a backlog
    try { ev.handle = this.engine.noteOn(GM[ev.voice], ev.vel, Math.max(at, c.ct)) || null; } catch (e) { ev.skipped = true; }
  }
  // the page held the main thread longer than the lookahead (a draw() over 100 ms): a hit was handed over late. Hand them
  // over further ahead from now on — a change to the pattern is then heard up to 0.3 s later, a fair price for a steady beat.
  _lateOne(margin) {
    this.late++;
    if (this.scheduler.lookahead < 0.3) { this.scheduler.lookahead = 0.3; this.extended = true; }
    if (this.onLate) { try { this.onLate(margin, this); } catch (e) { /* */ } }
  }
  _cancel(dropped, c) {
    for (const ev of dropped) {
      if (!ev.handle || typeof ev.handle.cancel !== 'function') continue;
      if (ev.time - this._k > c.ct + 0.003) ev.handle.cancel();   // one that already started rings out
    }
  }
  _deliver(c) {
    const evs = this.scheduler.due(c.heard);
    if (!evs.length) return evs;
    const hidden = this._hidden();
    let lastBar = -1;
    for (const ev of evs) if (ev.kind === 'step' && ev.i === 0 && (hidden || c.heard - ev.time > this.stale)) lastBar = ev.n;
    for (const ev of evs) {
      ev.quiet = hidden || c.heard - ev.time > this.stale;
      if (ev.kind === 'step') {
        ev.announce = !ev.quiet || ev.n === lastBar;
        if (this.onStep) { try { this.onStep(ev.i, ev.n, ev); } catch (e) { console.error('[drums] onStep', e); } }
      } else {
        if (!this._clocked && this.engine && typeof this.engine.noteOn === 'function') {   // an engine with no clock to schedule on: play it now
          try { this.engine.noteOn(GM[ev.voice], ev.vel); } catch (e) { /* */ }
        }
        if (!ev.quiet && this.onHit) { try { this.onHit(ev.voice, ev.vel, ev); } catch (e) { console.error('[drums] onHit', e); } }
      }
    }
    return evs;
  }
  // the heartbeat: a Blob Web Worker's timer (a hidden tab throttles the page's own timers to once a second or less, not a
  // worker's); where a worker cannot start (a strict Content-Security-Policy, a sandbox) the page's setInterval, which
  // Chrome leaves alone while the tab is playing sound. `heartbeat` says which one runs; `heartbeatWhy` why the fallback.
  _beat() {
    if (this._hb || this.heartbeatMode === false || this.heartbeatMode === 'none') return;
    const ms = Math.max(5, Math.round(this.tick * 1000)), beat = () => this.pump();
    const interval = (why) => {
      if (this._hb) this._hb.stop();
      const id = setInterval(beat, ms);
      this._hb = { stop: () => clearInterval(id) }; this.heartbeat = 'interval'; this.heartbeatWhy = why;
    };
    if (this.heartbeatMode === 'interval') return interval('asked for');
    let url = null;
    try {
      url = URL.createObjectURL(new Blob([`setInterval(function () { postMessage(0); }, ${ms});`], { type: 'text/javascript' }));
      const w = new Worker(url);
      let alive = false;
      const hb = this._hb = { stop: () => { try { w.terminate(); } catch (e) { /* */ } try { URL.revokeObjectURL(url); } catch (e) { /* */ } } };
      w.onmessage = () => { alive = true; beat(); };
      w.onerror = () => { if (this._hb === hb) interval('the worker failed'); };
      this.heartbeat = 'worker'; this.heartbeatWhy = '';
      setTimeout(() => { if (!alive && this._hb === hb) interval('the worker never ticked'); }, 1500);
    } catch (e) {
      try { if (url) URL.revokeObjectURL(url); } catch (x) { /* */ }
      interval(`no worker here (${(e && (e.name || e.message)) || e})`);
    }
  }
  _unbeat() { if (this._hb) { this._hb.stop(); this._hb = null; } this.heartbeat = 'none'; }
}

const CSS = `
.oav-drums { font: 11px ui-monospace, monospace; color: #8892a8; }
.oav-drums .bar { display: flex; gap: 8px; align-items: center; margin-bottom: 6px; flex-wrap: wrap; }
.oav-drums select, .oav-drums input[type=range] { accent-color: #2e6df6; background: #1a2030;
  color: #cfd6e4; border: 1px solid #2a3348; border-radius: 6px; font: inherit; }
.oav-drums .barno { color: #cfd6e4; font-variant-numeric: tabular-nums; white-space: nowrap; }
.oav-drums .grid { display: grid; grid-template-columns: minmax(40px, max-content) repeat(16, 1fr); gap: 2px; }
.oav-drums .lane-lbl { color: #667; align-self: center; white-space: nowrap; padding-right: 4px; }
.oav-drums .lane-lbl.x { color: #8892a8; }
.oav-drums .cell { position: relative; aspect-ratio: 1; background: #131826; border: 1px solid #1c2334; border-radius: 3px;
  cursor: pointer; min-width: 10px; box-sizing: border-box; }
.oav-drums .cell.x { cursor: default; }
.oav-drums .cell.on { background: #2e6df6; }
.oav-drums .cell.on.part { background: #131826; border-color: #2e6df6; }
.oav-drums .cell i { position: absolute; top: 18%; bottom: 18%; width: 3px; margin-left: 0; background: #6f9bff; border-radius: 1px; }
.oav-drums .cell.beat { border-color: #2a3348; }
.oav-drums .cell.now { outline: 2px solid #ffd166; outline-offset: -1px; background: #2b3550; }
.oav-drums .cell.on.now { background: #ffd166; }
.oav-drums .cell.on.part.now { background: #2b3550; }
.oav-drums .cell.now i { background: #ffd166; }
.oav-drums .scorebar { display: flex; flex-wrap: wrap; gap: 4px 6px; align-items: flex-start; margin: 0 0 6px; }
.oav-drums .scorebar[hidden], .oav-drums .note[hidden] { display: none; }
.oav-drums .score { position: relative; flex: 1 1 220px; min-width: 0; margin: 0; font: 13px/1.6 ui-monospace, Menlo, monospace; color: #cfd6e4; white-space: pre-wrap; word-break: break-all; }
.oav-drums .score .view { white-space: pre-wrap; word-break: break-all; min-height: 1.6em; }
.oav-drums .score .tok { border-radius: 3px; transition: background-color .3s ease-out, color .3s ease-out; }
.oav-drums .score .tok.lit { background: #ffd166; color: #14141a; transition: none; }
.oav-drums .score .bad { border-radius: 3px; background: rgba(224, 107, 95, .3); color: #ffc2b8; text-decoration: underline wavy #ff8a7a; }
.oav-drums .score.edit { cursor: text; border-radius: 4px; box-shadow: 0 0 0 1px #2a3348; padding: 0 3px; }
.oav-drums .score.edit:hover { box-shadow: 0 0 0 1px #3a4a6a; }
.oav-drums .score.edit:focus-within { box-shadow: 0 0 0 1px #6f9bff; }
.oav-drums .score textarea { position: absolute; inset: 0 3px; width: calc(100% - 6px); height: 100%; box-sizing: border-box; margin: 0; padding: 0; border: 0;
  outline: 0; resize: none; overflow: hidden; background: transparent; color: transparent; caret-color: #ffd166; font: inherit; letter-spacing: inherit;
  white-space: pre-wrap; word-break: break-all; overflow-wrap: anywhere; }
.oav-drums .score textarea::selection { background: rgba(111, 155, 255, .45); color: transparent; }
.oav-drums .tools { display: flex; gap: 4px; flex: none; }
.oav-drums .tools button, .oav-drums .tools a { font: 11px/1.6 ui-monospace, Menlo, monospace; padding: 1px 6px; border: 1px solid #2a3348; border-radius: 5px;
  background: #1a2030; color: #cfd6e4; cursor: pointer; text-decoration: none; white-space: nowrap; }
.oav-drums .tools button:hover, .oav-drums .tools a:hover { border-color: #6f9bff; }
.oav-drums .tools button:disabled { opacity: .4; cursor: default; border-color: #2a3348; }
.oav-drums .note { margin: -2px 0 6px; color: #e0c25f; font-size: 11px; }
.oav-drums .cell.armed { outline: 1px dashed #e0c25f; outline-offset: -1px; }
`;

// the lane names a person reads; the voices themselves keep their English names everywhere in code
const DRUM_NAMES = {
  en: { kick: 'kick', snare: 'snare', hat: 'hat', clap: 'clap', openhat: 'open hat', pedalhat: 'pedal hat', rim: 'rim', lowtom: 'low tom',
    tom: 'tom', hightom: 'high tom', crash: 'crash', ride: 'ride', cowbell: 'cowbell' },
  zh: { kick: '大鼓', snare: '小鼓', hat: '鈸', clap: '拍手', openhat: '開鈸', pedalhat: '踩鈸', rim: '鼓邊', lowtom: '落地鼓',
    tom: '中鼓', hightom: '高音中鼓', crash: '碎音鈸', ride: '疊音鈸', cowbell: '牛鈴' },
};
const DRUM_WORDS = {
  en: { machine: 'drum machine', bar: 'bar {n}', rhythm: 'rhythm string', undo: '↶', undoTitle: 'Undo the last change (⌘Z / Ctrl+Z)', copy: 'Copy',
    copied: 'Copied', copyFail: 'Select and copy', copyTitle: 'Copy this line', strudel: 'Open in Strudel', strudelTitle: 'Open this line in strudel.cc (a new tab)',
    editTitle: 'Click to change it: Enter, or a short pause, plays it', lossy: 'The cells cannot hold all of this line: click again to rewrite it the grid\'s way (↶ brings it back).' },
  zh: { machine: '鼓機', bar: '第 {n} 小節', rhythm: '節奏字串', undo: '↶', undoTitle: '復原上一步（⌘Z／Ctrl+Z）', copy: '複製',
    copied: '已複製', copyFail: '請選取後複製', copyTitle: '複製這一行', strudel: '在 Strudel 打開', strudelTitle: '在 strudel.cc 打開這一行（新分頁）',
    editTitle: '點一下就能改：按 Enter 或停手一下就套用', lossy: '格子寫不出這一行的全部：再點一次就換成格子的寫法（↶ 可以復原）。' },
};
/** the name a person reads for a voice: drumName('kick', 'zh') → '大鼓' */
export function drumName(voice, lang = 'en') { return (DRUM_NAMES[lang === 'zh' ? 'zh' : 'en'] || DRUM_NAMES.en)[voice] || voice; }

/** mountDrums — TR-style grid + transport, publishing standard signals.
 *  Returns { seq, engine, root, clock, play(on), setPattern(p, { text }), setBpm(bpm), update(dt), deliver(), phase(), now(),
 *  info(), dispose } and, with a rhythm module (0.7): useRhythm(mod), src(), strudelUrl(), history, undo(), edit(text), copy(),
 *  copyText(), barEvents(bar), voices(). play / setPattern / setBpm are what the checkbox, the menu and the slider do, for code.
 *  clock: 'frame' (default; the machine moves in update(dt), as a show's loop calls it) or 'lookahead' (hits are handed to
 *  the kit ahead of time on its audio clock by a heartbeat of their own, and told in update() when heard: steady under a
 *  heavy frame and in a hidden tab; a compiled rhythm string plays as written). lang: 'zh' names the lanes in Chinese.
 *  onHit(voice, velocity, ev) and onStep(i, n, ev) are told when a hit / a 16th is heard (ev.quiet: told while nobody
 *  watches — hidden — or late; ev.announce: a bar start to announce). onTakeover({ text, bar, offGrid, dropped }): a click
 *  on a cell turned a rhythm string into the grid it was playing (only without a rhythm module).
 *
 *  rhythm: @openav/pattern (or anything with its compile, fromGrid, toGrid, strudelUrl; also later through useRhythm(mod)).
 *  With it the cells and the line edit each other: the line over the grid is always there (a preset shows the line its grid
 *  is) and can be typed into (Enter, or 400 ms without a key, plays it; a mistake is marked red, onEditError(error, text) is
 *  told and the last line that worked keeps playing; onEditError(null) once it is fixed); a click on a cell rewrites the line
 *  (fromGrid), and when the line holds more than the 16 steps can (triplets, < >, ?, /2, bd:2) the first click only calls
 *  onLossy({ text, bar, lost }) and the next one rewrites it. Every change from a click or a key is kept in `history` (↶ on
 *  the card, ⌘Z / Ctrl+Z after touching the card). onRhythm(line, { how: 'code' | 'cell' | 'type' | 'undo' | 'menu' }) hears
 *  every new line. copyText(line, bpm) shapes what Copy puts on the clipboard; strudelComment heads the strudel.cc code. */
export function mountDrums(container, { signals, engine = null, autoEnableEngine = true, onStep = null, onHit = null, onTakeover = null,
  bpm = 112, pattern = 'four on floor', clock = 'frame', lang = 'en', heartbeat = 'auto', latency = 'auto', now, hidden,
  rhythm = null, onRhythm = null, onLossy = null, onEditError = null, copyText = null, strudelComment = '' } = {}) {
  if (!document.getElementById('openav-drums-css')) {
    const st = document.createElement('style');
    st.id = 'openav-drums-css';
    st.textContent = CSS;
    document.head.appendChild(st);
  }
  const L = lang === 'zh' ? 'zh' : 'en', W = DRUM_WORDS[L];
  const ahead = clock === 'lookahead' || clock === 'audio';
  const root = document.createElement('div');
  root.className = 'oav-drums';
  root.innerHTML = `
    <div class="bar">
      <label style="cursor:pointer"><input type="checkbox" data-play> ${W.machine}</label>
      <select data-pattern>${Object.keys(PATTERNS).map(p => `<option>${p}</option>`).join('')}<option hidden>custom</option><option hidden value="rhythm">${W.rhythm}</option></select>
      <label>bpm <input type="range" data-bpm min="60" max="180" value="${bpm}" style="width:70px"></label>
      <span data-bpmv>${bpm}</span>
      <span class="barno" data-barno></span>
    </div>
    <div class="scorebar" data-scorebar hidden>
      <div class="score" data-score hidden><div class="view"></div></div>
      <div class="tools" data-tools hidden>
        <button type="button" data-undo title="${W.undoTitle}" aria-label="${W.undoTitle}" disabled>${W.undo}</button>
        <button type="button" data-copy title="${W.copyTitle}">${W.copy}</button>
        <a data-strudel target="_blank" rel="noopener" title="${W.strudelTitle}">${W.strudel}</a>
      </div>
    </div>
    <div class="note" data-note hidden></div>
    <div class="grid"></div>`;
  container.appendChild(root);

  const kit = engine || drumEngine();
  let kitReady = false;
  const envs = { kick: 0, snare: 0, hat: 0, clap: 0 };
  const defined = new Set();
  const defineVoice = (v) => {
    if (!signals || defined.has(v)) return;
    defined.add(v);
    signals.define?.(`drum/${v}`, { kind: 'pulse', source: 'drums' });
    signals.define?.(`drum/${v}/env`, { source: 'drums' });
  };
  for (const l of LANES) defineVoice(l);

  // what the page hears: the same lanes a mic'd drummer would fill (audio/*) — simulator contract
  const heard = (voice, vel, ev) => {
    defineVoice(voice);
    envs[voice] = Math.min(1, 0.4 + vel);
    signals?.pulse(`drum/${voice}`, { level: vel });
    signals?.pulse('midi/note/on', { note: GM[voice], vel, ch: 10 });
    if (ev && ev.token) light(ev.token);
    if (onHit) onHit(voice, vel, ev);
  };
  let curStep = -1, curBar = 0;
  const stepped = (i, n, ev) => {
    curStep = i;
    const bar = Math.floor(n / STEPS) + 1;
    if (bar !== curBar) { curBar = bar; barEl.textContent = W.bar.replace('{n}', bar); if (varies && seq.mode === 'string') paintCells(bar); }
    if (onStep) onStep(i, n, ev);
  };
  const seq = ahead
    ? new DrumTransport({ scheduler: new DrumScheduler({ bpm, pattern }), engine: kit, autoEnable: autoEnableEngine, heartbeat, latency, now, hidden,
      onStep: stepped, onHit: heard })
    : new DrumSequencer({
      onStep: stepped, bpm, pattern,
      onHit: async (lane, vel) => {
        if (!kitReady && autoEnableEngine) { kitReady = true; await kit.enable(); }
        kit.noteOn(GM[lane], vel);
        heard(lane, vel);
      },
    });
  const sched = () => (ahead ? seq.scheduler : null);
  let R = rhythm && typeof rhythm.compile === 'function' && typeof rhythm.fromGrid === 'function' ? rhythm : null;

  // grid UI: the four lanes, plus a row for each other voice a rhythm string plays (crash, ride, toms…; clickable with a rhythm module)
  const grid = root.querySelector('.grid'), scoreEl = root.querySelector('[data-score]'), barEl = root.querySelector('[data-barno]');
  const viewEl = scoreEl.querySelector('.view'), scoreBar = root.querySelector('[data-scorebar]'), toolsEl = root.querySelector('[data-tools]');
  const undoEl = root.querySelector('[data-undo]'), copyEl = root.querySelector('[data-copy]'), strudelEl = root.querySelector('[data-strudel]');
  const noteEl = root.querySelector('[data-note]');
  const playEl = root.querySelector('[data-play]'), patEl = root.querySelector('[data-pattern]');
  const bpmEl = root.querySelector('[data-bpm]'), bpmV = root.querySelector('[data-bpmv]');
  const showPattern = () => { patEl.value = seq.mode === 'string' ? 'rhythm' : seq.pattern; };
  let cells = {}, rows = LANES.slice(), shown = 1, varies = false, frameText = '', lastStep = -1;
  const voicesNow = () => {
    if (seq.mode !== 'string') return LANES.slice();
    const seen = new Set();
    for (let b = 1; b <= 8; b++) for (const e of sched().barEvents(b)) if (!LANE_SET.has(e.voice)) seen.add(e.voice);
    return LANES.concat([...seen].sort((a, b) => RANK[a] - RANK[b]));
  };
  const sig = (b) => sched().barEvents(b).map((e) => e.voice + '@' + e.pos.toFixed(6)).join(',');
  const paintCells = (bar) => {
    shown = bar;
    if (seq.mode === 'string') {
      const per = {};
      for (const v of rows) per[v] = Array.from({ length: STEPS }, () => []);
      for (const e of sched().barEvents(bar)) {
        if (!per[e.voice]) continue;
        const x = e.pos * STEPS, i = Math.min(STEPS - 1, Math.floor(x + 1e-7));
        per[e.voice][i].push(Math.max(0, x - i));
      }
      for (const v of rows) for (let i = 0; i < STEPS; i++) {
        const c = cells[v][i], f = per[v][i], exact = f.length === 1 && f[0] < 1e-6;
        c.classList.toggle('on', f.length > 0);
        c.classList.toggle('part', f.length > 0 && !exact);       // off the 16th grid (a triplet) or several in one step
        c.innerHTML = f.length && !exact ? f.map((fr) => `<i style="left:${(fr * 100).toFixed(1)}%"></i>`).join('') : '';
      }
      return;
    }
    for (const v of rows) for (let i = 0; i < STEPS; i++) { const c = cells[v][i]; c.classList.toggle('on', !!seq.grid[v][i]); c.classList.remove('part'); if (c.firstChild) c.innerHTML = ''; }
  };

  // ---- the line (0.7): what plays, as text; with a rhythm module it is always there and the cells and the keys both edit it
  const lineNow = () => {
    if (seq.mode === 'string') return seq.text;
    if (frameText) return frameText;
    if (!R) return '';
    try { return R.fromGrid(seq.grid, { order: LANES }); } catch (e) { return ''; }
  };
  const history = [];
  let how = 'code', lastLine = null, armed = null, armedCell = null;
  const remember = (prev) => {
    if (prev == null || prev === '' || history[history.length - 1] === prev) return;
    history.push(prev);
    if (history.length > 50) history.shift();
  };
  // a compiled line plays: on the lookahead clock as written; the frame clock plays its first bar on the grid
  const playCompiled = (c, text) => {
    if (!ahead) {
      const r = new DrumScheduler({ pattern: c }).gridOf(1);
      seq.setPattern(r.grid); frameText = text;
      if ((r.offGrid || r.dropped.length) && typeof console !== 'undefined') console.info(`[drums] the frame clock plays 16 steps on four lanes: ${r.offGrid} hit(s) moved to the nearest 16th${r.dropped.length ? ', ' + r.dropped.join(', ') + ' left out' : ''}`);
    } else seq.setPattern(c, { text });
  };
  // a line from a person (typed, a click, undo): compiled, played, kept in history → { ok, error }
  const setLine = (text, why) => {
    if (!R) return { ok: false, error: { code: 'no-rhythm', index: 0, length: 0, message: 'no rhythm module' } };
    text = String(text ?? '');
    let src = text;
    if (typeof R.fromStrudel === 'function') { const s = R.fromStrudel(text); if (s.strudel && s.ok) src = s.src; }
    const c = R.compile(src);
    if (!c.ok) return { ok: false, error: c.error, text: src };
    const prev = lineNow();
    if (why !== 'undo') remember(prev);
    playCompiled(c, src);
    how = why; armed = null; draft = null; bad = null;
    rebuild();
    return { ok: true, error: null, text: src };
  };

  const clickCell = (lane, i) => {
    if (seq.mode === 'string' && R && typeof R.toGrid === 'function') {
      const text = seq.text, bar = shown;
      const g = R.toGrid(sched().source, { bar, steps: STEPS });
      if (!g.ok) return;
      if (!g.exact && armed !== text) {              // say first what the grid cannot keep; the next click rewrites it
        armed = text; armedCell?.classList.remove('armed'); armedCell = cells[lane][i]; armedCell.classList.add('armed');
        if (onLossy) onLossy({ text, bar, lost: g.lost }); else { noteEl.textContent = W.lossy; noteEl.hidden = false; }
        return;
      }
      if (!g.grid[lane]) g.grid[lane] = new Array(STEPS).fill(0);
      g.grid[lane][i] = g.grid[lane][i] ? 0 : 1;
      setLine(R.fromGrid(g.grid, { steps: STEPS, words: g.words, order: g.voices }), 'cell');
      return;
    }
    if (seq.mode === 'string') {           // no rhythm module: the cells take over (0.6), the string becomes the grid it was playing
      const text = seq.text, bar = shown;
      const r = seq.takeover(bar);
      seq.toggleCell(lane, i);
      rebuild();
      if (onTakeover) onTakeover({ text, bar, offGrid: r.offGrid, dropped: r.dropped, varied: varies });
      return;
    }
    if (!LANE_SET.has(lane)) return;
    const prev = R ? lineNow() : null;
    seq.toggleCell(lane, i); cells[lane][i].classList.toggle('on'); showPattern();
    if (frameText) frameText = R ? R.fromGrid(seq.grid, { order: LANES }) : '';
    if (R) { remember(prev); how = 'cell'; }
    refreshLine();
  };
  const buildGrid = () => {
    grid.innerHTML = ''; cells = {}; rows = voicesNow(); lastStep = -1; armedCell = null;
    for (const v of rows) {
      const x = !LANE_SET.has(v), fixed = x && !R;
      grid.appendChild(Object.assign(document.createElement('div'), { className: 'lane-lbl' + (x ? ' x' : ''), textContent: drumName(v, L) }));
      cells[v] = [];
      for (let i = 0; i < STEPS; i++) {
        const c = document.createElement('div');
        c.className = 'cell' + (i % 4 === 0 ? ' beat' : '') + (fixed ? ' x' : '');
        if (!fixed) c.addEventListener('click', () => clickCell(v, i));
        grid.appendChild(c);
        cells[v].push(c);
      }
    }
    paintCells(seq.mode === 'string' && curBar ? curBar : 1);
  };

  // the score line: the rhythm string over the grid; the word that sounds lights up and fades (never the whole line)
  let segs = [], ranges = new Map(), litUntil = new Map();
  let draft = null, bad = null, typing = null, composing = false, ta = null;
  const addRange = (t) => {
    if (!t || !(t.end > t.start)) return false;
    const key = t.start + ':' + t.end;
    if (ranges.has(key)) return false;
    ranges.set(key, { start: t.start, end: t.end });
    return true;
  };
  const renderScore = () => {
    const text = draft != null ? draft : lineNow();
    viewEl.innerHTML = ''; segs = []; litUntil.clear();
    const show = !!text || draft != null;
    scoreEl.hidden = !show; scoreBar.hidden = !show;
    if (ta && draft == null && ta.value !== text) ta.value = text;
    if (!text) { viewEl.textContent = '​'; return; }
    if (draft != null) {                    // being typed: the text as it is, the mistake marked
      if (bad && bad.end > bad.start) {
        const a = Math.max(0, Math.min(text.length, bad.start)), b = Math.max(a, Math.min(text.length, bad.end));
        viewEl.append(text.slice(0, a));
        const m = document.createElement('span'); m.className = 'bad'; m.textContent = text.slice(a, b) || ' ';
        viewEl.append(m, text.slice(b));
      } else viewEl.textContent = text;
      return;
    }
    const cut = new Set([0, text.length]);
    for (const r of ranges.values()) { cut.add(Math.max(0, Math.min(text.length, r.start))); cut.add(Math.max(0, Math.min(text.length, r.end))); }
    const at = [...cut].sort((a, b) => a - b);
    for (let k = 0; k + 1 < at.length; k++) {
      const a = at[k], b = at[k + 1], span = document.createElement('span');
      span.textContent = text.slice(a, b);
      if ([...ranges.values()].some((r) => r.start <= a && b <= r.end)) span.className = 'tok';
      viewEl.appendChild(span);
      segs.push({ a, b, el: span });
    }
  };
  const showScore = () => {
    ranges = new Map();
    if (seq.mode === 'string') for (let b = 1; b <= 16; b++) for (const e of sched().barEvents(b)) addRange(e.token);
    renderScore();
  };
  const clockNow = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());
  function light(t) {
    if (!segs.length || seq.mode !== 'string' || draft != null) return;
    if (addRange(t)) renderScore();
    const until = clockNow() + 120;
    for (const s of segs) if (s.a >= t.start && s.b <= t.end && s.b > s.a) { s.el.classList.add('lit'); litUntil.set(s, { until, start: t.start, end: t.end }); }
  }
  const fade = () => {
    if (!litUntil.size) return;
    const t = clockNow();
    for (const [s, x] of litUntil) if (x.until <= t) { s.el.classList.remove('lit'); litUntil.delete(s); }
  };
  const strudelHref = () => (R && typeof R.strudelUrl === 'function' && lineNow() ? R.strudelUrl(lineNow(), { bpm: seq.bpm, comment: strudelComment }) : '');
  const paintTools = () => {
    toolsEl.hidden = !R;
    undoEl.disabled = !history.length;
    const href = strudelHref();
    if (href) strudelEl.href = href; else strudelEl.removeAttribute('href');
    strudelEl.hidden = !href;
  };
  // the line moved on: the view, the tools, and whoever listens (once per new line)
  const refreshLine = () => {
    showScore(); paintTools();
    if (!armed) { noteEl.hidden = true; armedCell?.classList.remove('armed'); armedCell = null; }
    const line = lineNow();
    if (line !== lastLine) {
      const was = lastLine; lastLine = line;
      if (onRhythm && (line || was)) { try { onRhythm(line, { how, prev: was }); } catch (e) { console.error('[drums] onRhythm', e); } }
    }
    how = 'code';
  };
  const rebuild = () => {
    varies = seq.mode === 'string' && [2, 3, 4, 5, 6, 7, 8].some((b) => sig(b) !== sig(1));
    buildGrid(); showPattern(); refreshLine();
  };

  // ---- typing into the line: the textarea lies over the view, its own text invisible, so the lit words stay where they are
  const editable = () => {
    if (ta || !R) return;
    ta = document.createElement('textarea');
    ta.spellcheck = false; ta.rows = 1; ta.setAttribute('autocomplete', 'off'); ta.setAttribute('autocapitalize', 'off');
    ta.setAttribute('aria-label', W.rhythm); ta.title = W.editTitle;
    scoreEl.classList.add('edit'); scoreEl.title = W.editTitle;
    scoreEl.appendChild(ta);
    ta.value = lineNow();
    const apply = () => {
      clearTimeout(typing); typing = null;
      if (draft == null) return;
      const text = draft, r = setLine(text, 'type');
      if (r.ok) { if (onEditError) onEditError(null); return; }
      bad = { start: r.error.index | 0, end: (r.error.index | 0) + Math.max(1, r.error.length | 0) };
      renderScore();
      if (onEditError) onEditError(r.error, text);
    };
    ta.addEventListener('input', () => {
      draft = ta.value === lineNow() ? null : ta.value;
      bad = null;
      renderScore();
      clearTimeout(typing);
      if (draft == null) { if (onEditError) onEditError(null); return; }
      if (!composing) typing = setTimeout(apply, 400);
    });
    ta.addEventListener('compositionstart', () => { composing = true; clearTimeout(typing); });
    ta.addEventListener('compositionend', () => { composing = false; clearTimeout(typing); if (draft != null) typing = setTimeout(apply, 400); });
    ta.addEventListener('keydown', (e) => {
      e.stopPropagation();                    // typed letters are not the sketch's keys, nor a show's QWERTY keyboard
      if (e.isComposing || composing) return;
      if (e.key === 'Enter') { e.preventDefault(); apply(); }
      else if (e.key === 'Escape') { clearTimeout(typing); draft = null; bad = null; ta.value = lineNow(); renderScore(); ta.blur(); if (onEditError) onEditError(null); }
      else if ((e.metaKey || e.ctrlKey) && !e.shiftKey && !e.altKey && (e.key === 'z' || e.key === 'Z') && draft == null && history.length) { e.preventDefault(); undo(); }
    });
    for (const t of ['keyup', 'keypress']) ta.addEventListener(t, (e) => e.stopPropagation());
    ta.addEventListener('blur', () => { if (draft != null && !bad) apply(); });
  };
  const undo = () => {
    if (!R || !history.length) return false;
    const prev = history.pop(), r = setLine(prev, 'undo');
    if (!r.ok) { paintTools(); return false; }
    if (onEditError) onEditError(null);
    if (ta && document.activeElement !== ta) ta.value = lineNow();
    return true;
  };
  let lastCopied = '';
  const copyNow = () => (copyText ? copyText(lineNow(), seq.bpm) : lineNow());
  const copy = async () => {
    const text = copyNow();
    let ok = false;
    try { if (navigator.clipboard && navigator.clipboard.writeText) { await navigator.clipboard.writeText(text); ok = true; } } catch (e) { /* an iframe without clipboard-write */ }
    if (!ok) {
      try {
        const t = document.createElement('textarea');
        t.value = text; t.setAttribute('readonly', ''); t.style.cssText = 'position:fixed;left:-9999px;top:0;opacity:0';
        root.appendChild(t); t.select(); ok = document.execCommand('copy'); t.remove();
      } catch (e) { ok = false; }
    }
    lastCopied = text;
    copyEl.textContent = ok ? W.copied : W.copyFail;
    if (!ok && ta) { ta.focus(); ta.select(); }
    setTimeout(() => { copyEl.textContent = W.copy; }, 1400);
    return { ok, text };
  };
  undoEl.addEventListener('click', () => undo());
  copyEl.addEventListener('click', () => { copy(); });
  // ⌘Z / Ctrl+Z after the last press was on the card (a press on the canvas gives the keys back to the sketch)
  const win = root.ownerDocument && root.ownerDocument.defaultView;
  let touched = false;
  const onDown = (e) => { touched = root.contains(e.target); };
  const onKey = (e) => {
    if (!touched || !(e.metaKey || e.ctrlKey) || e.shiftKey || e.altKey || (e.key !== 'z' && e.key !== 'Z')) return;
    const t = e.target;
    if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName || ''))) return;
    if (undo()) e.preventDefault();
  };
  if (win) { win.addEventListener('pointerdown', onDown, true); win.addEventListener('keydown', onKey, true); }

  if (R) editable();
  rebuild();

  playEl.addEventListener('change', (e) => seq.toggle(e.target.checked));
  patEl.addEventListener('change', (e) => { const v = e.target.value; if (v !== 'custom' && v !== 'rhythm') { const prev = lineNow(); frameText = ''; seq.setPattern(v); if (R) { remember(prev); how = 'menu'; } rebuild(); } });
  const tempo = (v) => { if (ahead) seq.setBpm(v); else seq.bpm = v; paintTools(); };
  bpmEl.addEventListener('input', () => { tempo(Number(bpmEl.value)); bpmV.textContent = bpmEl.value; });

  const paintNow = () => {
    const cur = seq.playing ? curStep : -1;
    if (cur === lastStep) return;
    for (const v of rows) {
      if (lastStep >= 0) cells[v][lastStep].classList.remove('now');
      if (cur >= 0) cells[v][cur].classList.add('now');
    }
    lastStep = cur;
  };
  // the frame clock's phase: how far the 16th in progress has come
  const framePhase = () => {
    const sd = seq.stepDur(), k = seq._step - 1 + Math.max(0, Math.min(1, 1 - (seq._nextStep - seq._t) / sd));
    const pos = Math.max(0, k) / STEPS;
    return { pos, bar: pos - Math.floor(pos), beat: pos * 4 - Math.floor(pos * 4) };
  };
  let lastPhase = { pos: 0, bar: 0, beat: 0 };
  const phase = () => (ahead ? seq.phase() : (lastPhase = seq.playing ? framePhase() : lastPhase));
  /** the hits of bar `bar` as they play: [{ voice, pos 0..1, dur? }] (a line's own bar, or the grid) */
  const barEvents = (bar) => {
    if (ahead) return sched().barEvents(Math.max(1, Math.floor(bar) || 1));
    const out = [];
    for (const lane of LANES) for (let i = 0; i < STEPS; i++) if (seq.grid[lane] && seq.grid[lane][i]) out.push({ voice: lane, pos: i / STEPS });
    return out;
  };
  return {
    seq,
    engine: kit,
    root,
    clock: ahead ? 'lookahead' : 'frame',
    /** start (true) or stop (false) the machine, as the checkbox does; no argument flips it */
    play(on = !seq.playing) { seq.toggle(!!on); playEl.checked = seq.playing; return seq.playing; },
    /** a preset name, your own { kick: 'x...x...', … }, or a compiled rhythm string ({ text } shows the line over the grid);
     *  the menu, the cells and the score line follow. The frame clock plays a rhythm string's first bar on the grid. */
    setPattern(p, o = {}) {
      if (p && typeof p.eventsInBar === 'function') playCompiled(p, o.text || '');
      else { frameText = ''; seq.setPattern(p, o); }
      armed = null;
      if (!(ta && draft != null && document.activeElement === ta)) { draft = null; bad = null; }   // a cue never wipes what is being typed
      rebuild();
      return seq.pattern;
    },
    setBpm(v) { tempo(Number(v) || seq.bpm); bpmEl.value = seq.bpm; bpmV.textContent = Math.round(seq.bpm); return seq.bpm; },
    update(dt) {
      if (ahead) seq.frame(); else seq.update(dt);
      for (const l in envs) {
        envs[l] *= Math.exp(-dt / 0.12);
        signals?.set(`drum/${l}/env`, envs[l]);
      }
      paintNow(); fade();
    },
    /** tell the page what is heard by now, without the grid's paint (p5's pre-draw: the callbacks land before draw()) */
    deliver() { if (ahead) seq.frame(); },
    /** { bar: 0..1 through the bar, beat: 0..1 through the beat, pos } where the listener is */
    phase,
    /** { bar, step, phase, beatPhase, tokens: [{ start, end }] lit in the score line } */
    now() {
      const p = phase(), tokens = [], seen = new Set();
      for (const x of litUntil.values()) { const k = x.start + ':' + x.end; if (!seen.has(k)) { seen.add(k); tokens.push({ start: x.start, end: x.end }); } }
      return { bar: curBar, step: curStep, phase: p.bar, beatPhase: p.beat, tokens, mode: seq.mode, text: lineNow() };
    },
    info() { return ahead ? seq.info() : { clock: 'frame', heartbeat: 'frame', lookahead: 0, late: 0, extended: false, audio: !!(kit.context && kit.context.state === 'running'), latency: 0 }; },
    /** hand over @openav/pattern later (it loads on its own): the line appears and becomes editable */
    useRhythm(mod) {
      if (R || !mod || typeof mod.compile !== 'function' || typeof mod.fromGrid !== 'function') return !!R;
      R = mod; editable(); rebuild();
      return true;
    },
    get rhythm() { return R; },
    /** the line that plays now ('' without a rhythm module while a grid plays) */
    src: lineNow,
    /** the line as a strudel.cc link (open it in a new tab), '' when there is none */
    strudelUrl: strudelHref,
    /** earlier lines, oldest first (a click, a key, the menu); undo() goes back one */
    history,
    undo,
    /** play a line as if typed: { ok, error }; a mistake is marked on the line, the last line that worked keeps playing */
    edit(text) {
      if (!R) return { ok: false, error: null };
      const r = setLine(text, 'type');
      if (!r.ok) {
        draft = String(text ?? ''); bad = { start: r.error.index | 0, end: (r.error.index | 0) + Math.max(1, r.error.length | 0) };
        if (ta) ta.value = draft;
        renderScore();
        if (onEditError) onEditError(r.error, draft);
      } else if (onEditError) onEditError(null);
      return r;
    },
    /** what Copy puts on the clipboard; copy() → Promise<{ ok, text }> */
    copyText: copyNow,
    copy,
    get copied() { return lastCopied; },
    barEvents,
    /** the rows on the grid now: the four lanes, then a line's other voices */
    voices() { return rows.slice(); },
    dispose() {
      seq.toggle(false); kit.dispose?.(); root.remove(); clearTimeout(typing);
      if (win) { win.removeEventListener('pointerdown', onDown, true); win.removeEventListener('keydown', onKey, true); }
    },
  };
}
