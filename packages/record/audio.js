// audio.js — AudioTap: the work's own sound, as a recordable track.
//
// Recording the speakers through a microphone gives you the room; tapping the
// WebAudio graph gives you the instrument exactly as it was synthesized, in the
// same page as the canvas, so picture and sound share one clock. AudioTap mixes
// everything into ONE track on purpose: Chrome's MediaRecorder records only the
// first audio track of a stream and silently drops the rest.
//
// Two outputs:
//   tap.stream      work + extras (the microphone, tracks you add with bus 'extra') → the video
//   tap.workStream  the work alone → the separate audio file
//
// Nothing is routed to the speakers by the tap: adding a microphone never feeds back.

const AC = () => globalThis.AudioContext || globalThis.webkitAudioContext;

// ---- capture-by-destination: a hook on AudioNode.prototype.connect --------------------------
// Anything that connects to an AudioDestinationNode (the speakers) after the hook is installed
// is also sent to every tap listening. This is how a host records a work it did not write
// (a p5.sound / Tone.js sketch) without touching it. Shared by all taps; uninstalled when the
// last tap lets go, unless something else has patched connect after us (then we stay inert).
const hooks = new Set();
let origConnect = null, patched = null;
function installHook(fn) {
  hooks.add(fn);
  if (patched || typeof AudioNode === 'undefined') return;
  origConnect = AudioNode.prototype.connect;
  patched = function connect(dest) {
    const out = origConnect.apply(this, arguments);
    if (typeof AudioDestinationNode !== 'undefined' && dest instanceof AudioDestinationNode) {
      for (const h of hooks) { try { h(this); } catch (e) { /* a tap must never break the work's audio */ } }
    }
    return out;
  };
  AudioNode.prototype.connect = patched;
}
function removeHook(fn) {
  hooks.delete(fn);
  if (hooks.size || !patched) return;
  if (AudioNode.prototype.connect === patched) AudioNode.prototype.connect = origConnect;
  patched = null; origConnect = null;
}

export class AudioTap {
  /**
   * @param {object} [opts]
   * @param {AudioContext} [opts.context] the mixing context; usually the work's own (created if omitted)
   * @param {Array<AudioNode|MediaStream|MediaStreamTrack>} [opts.sources] added to the work bus now
   * @param {boolean} [opts.captureDestination=false] also tap whatever connects to a destination from now on
   */
  constructor({ context = null, sources = [], captureDestination = false } = {}) {
    const Ctx = AC();
    if (!context && !Ctx) throw new Error('record: no WebAudio here');
    this.context = context || new Ctx();
    const ctx = this.context;
    this.workBus = ctx.createGain();
    this.extraBus = ctx.createGain();
    this.mixDest = ctx.createMediaStreamDestination();
    this.workDest = ctx.createMediaStreamDestination();
    this.workBus.connect(this.mixDest);
    this.workBus.connect(this.workDest);
    this.extraBus.connect(this.mixDest);
    this.analyser = ctx.createAnalyser();
    this.analyser.fftSize = 1024;
    this.workBus.connect(this.analyser);
    this.extraBus.connect(this.analyser);
    this._buf = new Float32Array(this.analyser.fftSize);
    this._bridges = new Map();    // per foreign AudioContext, for captureDestination → { dest, src, linked }
    this._nodes = new Set();      // AudioNodes already tapped (by capture), so a reconnect does not double them
    this._hook = null;
    this.mic = null;
    for (const s of sources) this.add(s);
    if (captureDestination) this.captureDestination();
  }

  /** Work + extras, one track: give it to the video Recorder. */
  get stream() { return this.mixDest.stream; }
  /** The work alone, one track: the separate audio file. */
  get workStream() { return this.workDest.stream; }
  /** `stream`'s audio tracks (one). */
  get tracks() { return this.mixDest.stream.getAudioTracks(); }
  /** `workStream`'s audio tracks (one). */
  get workTracks() { return this.workDest.stream.getAudioTracks(); }

  /**
   * Tap a source. An AudioNode of this context is connected directly; a node of
   * another AudioContext is bridged through a MediaStream; a MediaStream or a
   * MediaStreamTrack is brought in as a source node.
   * @param {AudioNode|MediaStream|MediaStreamTrack} source
   * @param {{ bus?: 'work'|'extra', gain?: number }} [opts] 'extra' reaches the video only, not the audio file
   * @returns {() => void} remove
   */
  add(source, { bus = 'work', gain = 1 } = {}) {
    const ctx = this.context, target = bus === 'extra' ? this.extraBus : this.workBus;
    const g = ctx.createGain(); g.gain.value = gain; g.connect(target);
    let input = null, cleanup = () => {};
    if (typeof MediaStreamTrack !== 'undefined' && source instanceof MediaStreamTrack) source = new MediaStream([source]);
    if (typeof MediaStream !== 'undefined' && source instanceof MediaStream) {
      input = ctx.createMediaStreamSource(source);
      input.connect(g);
      cleanup = () => { try { input.disconnect(); } catch (e) { /* */ } };
    } else if (source && typeof source.connect === 'function' && source.context) {
      if (source.context === ctx) {
        source.connect(g);
        cleanup = () => { try { source.disconnect(g); } catch (e) { /* already gone */ } };
      } else {
        // another AudioContext (a Tone.js context, a second page synth): bridge it through a
        // MediaStream of its own, so this source's gain and bus stay its own
        const dest = source.context.createMediaStreamDestination();
        source.connect(dest);
        input = ctx.createMediaStreamSource(dest.stream);
        input.connect(g);
        cleanup = () => { try { source.disconnect(dest); input.disconnect(); } catch (e) { /* */ } };
      }
    } else throw new TypeError('AudioTap.add: expected an AudioNode, a MediaStream or a MediaStreamTrack');
    return () => { cleanup(); try { g.disconnect(); } catch (e) { /* */ } };
  }

  _bridge(foreign) {
    let b = this._bridges.get(foreign);
    if (!b) {
      const dest = foreign.createMediaStreamDestination();
      const src = this.context.createMediaStreamSource(dest.stream);
      b = { dest, src };
      this._bridges.set(foreign, b);
    }
    return b;
  }

  /**
   * From now on, every node that connects to an AudioDestinationNode (any context)
   * is tapped too. Install it BEFORE the work starts its sound — a node connected
   * earlier is invisible. Idempotent.
   * @returns {() => void} uninstall
   */
  captureDestination() {
    if (!this._hook) {
      this._hook = (node) => {
        if (this._nodes.has(node)) {
          // reconnected after a disconnect(): the old tap link went with it — link again
          const ctx = this.context;
          try { node.context === ctx ? node.connect(this.workBus) : node.connect(this._bridge(node.context).dest); } catch (e) { /* */ }
          return;
        }
        this._nodes.add(node);
        if (node.context === this.context) node.connect(this.workBus);
        else { const b = this._bridge(node.context); node.connect(b.dest); if (!b.linked) { b.src.connect(this.workBus); b.linked = true; } }
      };
      installHook(this._hook);
    }
    return () => { if (this._hook) { removeHook(this._hook); this._hook = null; } };
  }

  /**
   * Add a microphone (or any audio input) to the video's mix — not to the audio file.
   * Processing is off by default: echo cancellation and noise suppression eat
   * piano attacks and room tone.
   * @param {{ deviceId?: string, gain?: number, echoCancellation?: boolean, noiseSuppression?: boolean, autoGainControl?: boolean }} [opts]
   * @returns {Promise<MediaStream>}
   */
  async addMicrophone({ deviceId = '', gain = 1, echoCancellation = false, noiseSuppression = false, autoGainControl = false } = {}) {
    this.removeMicrophone();
    const audio = { echoCancellation, noiseSuppression, autoGainControl };
    if (deviceId) audio.deviceId = { exact: deviceId };
    const stream = await navigator.mediaDevices.getUserMedia({ audio, video: false });
    this.mic = { stream, remove: this.add(stream, { bus: 'extra', gain }) };
    return stream;
  }

  /** Take the microphone out of the mix (and stop it unless `stop: false`). */
  removeMicrophone({ stop = true } = {}) {
    if (!this.mic) return;
    this.mic.remove();
    if (stop) this.mic.stream.getTracks().forEach((t) => t.stop());
    this.mic = null;
  }

  /** Peak level of the mix right now, 0..1 — for a "sound is reaching the recording" meter. */
  level() {
    this.analyser.getFloatTimeDomainData(this._buf);
    let p = 0;
    for (let i = 0; i < this._buf.length; i++) { const a = Math.abs(this._buf[i]); if (a > p) p = a; }
    return Math.min(1, p);
  }

  /** Resume a suspended context (call from a click). */
  resume() { return this.context.state === 'suspended' ? this.context.resume() : Promise.resolve(); }

  /** Let go of everything the tap made (the context itself is left alone). */
  dispose() {
    if (this._hook) { removeHook(this._hook); this._hook = null; }
    this.removeMicrophone();
    for (const n of [this.workBus, this.extraBus, this.analyser]) { try { n.disconnect(); } catch (e) { /* */ } }
    for (const b of this._bridges.values()) { try { b.src.disconnect(); } catch (e) { /* */ } }
    this._bridges.clear(); this._nodes.clear();
  }
}
