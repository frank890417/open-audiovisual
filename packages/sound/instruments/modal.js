// modalInstrument() · struck bars and tines as a handful of decaying sine partials.
//
// A xylophone bar, a glockenspiel bar and a music-box tine are the same physics
// with different numbers: a strike excites a few vibration modes, each rings at
// its own ratio to the fundamental and dies at its own rate, high notes faster
// than low ones. So a mallet instrument here is DATA (ratios, levels, decays,
// a short filtered-noise "tok" for the mallet) — see xylophone.js, 15 lines.
//
// Voices are raw WebAudio nodes on Tone's context, built per strike and left to
// the garbage collector: no Tone objects to pool, no dispose bookkeeping per note.
// Harder strikes brighten (upper partials grow faster with velocity), which is
// what a real mallet does and what makes fast runs feel alive.
//
//   modalInstrument({ id, name, category = 'mallets', partials: [{ ratio, gain, decay }],
//     strike: { ratio, q, gain, decay }, damp = 0, pitchDecay = 0.6, tremolo, … })
//
// decay is seconds to near silence at middle C; damp > 0 = noteOff mutes in that
// many seconds (vibraphone damper), 0 = bars ring free (xylophone, glockenspiel).

export function modalInstrument({
  id, name, category = 'mallets', credit = null, params, defaults = { cutoff: 8000 },
  partials, strike = null, damp = 0, pitchDecay = 0.6, transpose = 0, gain = 0,
  attack = 0.0015, tremolo = null, maxVoices = 40, set = null,
}) {
  const longest = Math.max(...partials.map((p) => p.decay));
  return {
    id, name, category, credit, params, defaults, transpose, gain,
    tail: Math.min(8, longest * 1.5 + 0.2),
    create(Tone, { output }) {
      const ctx = Tone.getContext().rawContext;
      // optional amplitude tremolo (the vibraphone's motor) between the voices and the output
      const trem = tremolo ? new Tone.Tremolo({ frequency: tremolo.frequency, depth: tremolo.depth, spread: tremolo.spread ?? 0 }).start().connect(output) : null;
      const bus = new Tone.Gain(1).connect(trem || output);
      const noise = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.12), ctx.sampleRate);
      const nd = noise.getChannelData(0);
      for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
      const voices = [];                      // oldest first: { note, g, srcs, end }
      const kill = (v, t, fade) => {
        v.g.gain.cancelScheduledValues(t);
        v.g.gain.setValueAtTime(v.g.gain.value, t);
        v.g.gain.setTargetAtTime(0, t, fade / 4);
        for (const s of v.srcs) { try { s.stop(t + fade + 0.05); } catch (e) {} }
        v.end = Math.min(v.end, t + fade);
      };
      const prune = (now) => { for (let i = voices.length - 1; i >= 0; i--) if (voices[i].end < now) voices.splice(i, 1); };
      const api = {
        noteOn(note, vel, time) {
          const now = ctx.currentTime, t = Math.max(time ?? now, now);
          prune(now);
          if (voices.length >= maxVoices) kill(voices.shift(), t, 0.03);
          const f0 = 440 * 2 ** ((note - 69) / 12);
          const scale = Math.min(3, Math.max(0.2, (261.63 / f0) ** pitchDecay));
          const g = ctx.createGain();
          g.connect(bus.input);
          const srcs = [];
          let end = t, last = null;
          partials.forEach((p, i) => {
            const f = f0 * p.ratio;
            if (f > ctx.sampleRate * 0.45) return;
            const d = p.decay * scale;
            const amp = p.gain * vel ** (1 + 0.6 * i) * 0.5;      // upper modes bloom with harder strikes
            const o = ctx.createOscillator();
            o.frequency.value = f;
            const pg = ctx.createGain();
            pg.gain.setValueAtTime(0, t);
            pg.gain.linearRampToValueAtTime(amp, t + attack);
            pg.gain.setTargetAtTime(0, t + attack, d / 6.9);        // ≈ −60 dB after d seconds
            o.connect(pg).connect(g);
            o.start(t); o.stop(t + attack + d + 0.05);
            srcs.push(o);
            if (t + attack + d >= end) { end = t + attack + d; last = o; }
          });
          if (strike) {                                              // the mallet: a few ms of band-passed noise
            const n = ctx.createBufferSource();
            n.buffer = noise;
            const bp = ctx.createBiquadFilter();
            bp.type = 'bandpass';
            bp.frequency.value = Math.min(ctx.sampleRate * 0.4, Math.max(200, f0 * strike.ratio));
            bp.Q.value = strike.q ?? 1;
            const ng = ctx.createGain();
            ng.gain.setValueAtTime(0, t);
            ng.gain.linearRampToValueAtTime(strike.gain * vel * vel, t + 0.0008);
            ng.gain.setTargetAtTime(0, t + 0.0008, strike.decay / 3);
            n.connect(bp).connect(ng).connect(g);
            n.start(t); n.stop(t + strike.decay * 4 + 0.02);
            srcs.push(n);
          }
          const v = { note, g, srcs, end };
          if (last) last.onended = () => { try { g.disconnect(); } catch (e) {} };
          voices.push(v);
        },
        noteOff(note, time) {
          if (!damp) return;                                         // free bars ring out
          const t = Math.max(time ?? ctx.currentTime, ctx.currentTime);
          for (const v of voices) if (v.note === note && v.end > t) kill(v, t, damp);
        },
        releaseAll(time) { if (damp) for (const v of voices) kill(v, Math.max(time ?? 0, ctx.currentTime), damp); },
        set(key, value) { set?.({ key, value, tremolo: trem, Tone }); },
        dispose() {
          const t = ctx.currentTime;
          for (const v of voices) kill(v, t, 0.05);
          voices.length = 0;
          setTimeout(() => { bus.dispose(); trem?.dispose(); }, 200);
        },
      };
      return api;
    },
  };
}
