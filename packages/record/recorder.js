// recorder.js — Recorder: one MediaRecorder for picture + sound.
//
// Sync by construction: the canvas track and the audio track enter the SAME
// MediaRecorder, which timestamps both from one clock. Recording the canvas and
// the sound separately and lining them up later is how drift gets in.
//
// Chunks: with `timeslice` the browser hands over a piece every N ms. A host can
// stream them somewhere (the lab POSTs each one to its server, so an hour-long
// 4K take never sits in the tab's memory) and/or keep them for a Blob at the end.

import { pickMime, extFor } from './mime.js?v=e353777';
import { recommendedBitrate } from './layout.js?v=e353777';

const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());
const MR = () => globalThis.MediaRecorder;

/**
 * Several audio tracks → one (Chrome records only the first audio track of a stream).
 * Needs a user gesture to have happened (it makes an AudioContext).
 * @param {MediaStreamTrack[]} tracks
 * @returns {{ track: MediaStreamTrack, close: () => void }}
 */
export function mixTracks(tracks) {
  const Ctx = globalThis.AudioContext || globalThis.webkitAudioContext;
  const ctx = new Ctx();
  const dest = ctx.createMediaStreamDestination();
  for (const t of tracks) ctx.createMediaStreamSource(new MediaStream([t])).connect(dest);
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  return { track: dest.stream.getAudioTracks()[0], close: () => { ctx.close().catch(() => {}); } };
}

export class Recorder {
  /**
   * @param {object} opts
   * @param {HTMLCanvasElement} [opts.canvas] what to record (usually `compositor.canvas`)
   * @param {MediaStream} [opts.stream] …or a ready video stream instead of a canvas
   * @param {number} [opts.fps=60] capture rate (see recommendedFps: 30 for 2.7K / 4K)
   * @param {MediaStreamTrack[]} [opts.audioTracks] e.g. `tap.tracks`; several are mixed into one
   * @param {boolean} [opts.audioOnly=false] record only the audio tracks (the separate sound file)
   * @param {number} [opts.videoBitsPerSecond] default recommendedBitrate(canvas size, fps)
   * @param {number} [opts.audioBitsPerSecond=192000]
   * @param {string} [opts.mimeType] force one; default pickMime(MediaRecorder.isTypeSupported)
   * @param {'mp4'|'webm'} [opts.prefer] container to try first when picking
   */
  constructor({ canvas = null, stream = null, fps = 60, audioTracks = [], audioOnly = false,
    videoBitsPerSecond, audioBitsPerSecond = 192000, mimeType, prefer = null } = {}) {
    if (!audioOnly && !canvas && !stream) throw new TypeError('Recorder: give it a canvas (or a stream), or audioOnly: true');
    this.canvas = canvas;
    this.source = stream;
    this.fps = fps;
    this.audioTracks = [...audioTracks];
    this.audioOnly = audioOnly;
    this.videoBitsPerSecond = videoBitsPerSecond;
    this.audioBitsPerSecond = audioBitsPerSecond;
    const M = MR();
    this.mimeType = mimeType ?? (M && typeof M.isTypeSupported === 'function' ? pickMime((m) => M.isTypeSupported(m), { audioOnly, prefer }) : '');
    this.t0 = null;            // performance.now() when recording started — EventLog.start(rec.t0)
    this.error = null;
    this._rec = null;
    this._result = null;
  }

  /** True when this browser can record a canvas. */
  static get supported() {
    return !!MR() && typeof HTMLCanvasElement !== 'undefined' && typeof HTMLCanvasElement.prototype.captureStream === 'function';
  }

  /** 'inactive' | 'recording' | 'paused' */
  get state() { return this._rec ? this._rec.state : 'inactive'; }
  get recording() { return this.state === 'recording'; }
  /** ms since start while recording; the take's length once stopped; 0 before. */
  get elapsed() { return this._result ? this._result.durationMs : this.recording ? now() - this.t0 : 0; }
  /** Bytes handed over so far. */
  get bytes() { return this._bytes || 0; }

  _buildStream() {
    const tracks = [];
    this._own = [];
    if (!this.audioOnly) {
      const v = this.source || this.canvas.captureStream(this.fps);
      if (!this.source) this._own.push(...v.getVideoTracks());   // ours to stop
      tracks.push(...v.getVideoTracks());
    }
    const audio = this.audioTracks.filter((t) => t && t.readyState !== 'ended');
    if (audio.length > 1) { this._mix = mixTracks(audio); tracks.push(this._mix.track); }
    else tracks.push(...audio);
    if (this.audioOnly && !tracks.length) throw new Error('Recorder: audioOnly needs at least one live audio track');
    return new MediaStream(tracks);
  }

  /**
   * Start recording.
   * @param {object} [opts]
   * @param {number} [opts.timeslice=1000] ms per chunk
   * @param {(blob: Blob, seq: number) => (void|Promise<void>)} [opts.ondata] each chunk, in order;
   *   a returned promise is awaited before the next chunk is handed over (uploads stay ordered) and before stop() resolves
   * @param {boolean} [opts.keep] keep chunks for the Blob in stop()'s result (default: true unless ondata is given)
   * @returns {this}
   */
  start({ timeslice = 1000, ondata = null, keep } = {}) {
    if (this._rec && this._rec.state !== 'inactive') return this;
    const M = MR();
    if (!M) throw new Error('Recorder: this browser has no MediaRecorder');
    const stream = this._buildStream();
    const hasVideo = stream.getVideoTracks().length > 0;
    const w = this.canvas ? this.canvas.width : 0, h = this.canvas ? this.canvas.height : 0;
    const opts = { audioBitsPerSecond: this.audioBitsPerSecond };
    if (hasVideo) opts.videoBitsPerSecond = this.videoBitsPerSecond ?? (w && h ? recommendedBitrate(w, h, this.fps) : 12e6);
    let rec;
    try { rec = new M(stream, this.mimeType ? { ...opts, mimeType: this.mimeType } : opts); }
    catch (e) { rec = new M(stream, opts); this.mimeType = ''; }   // a refused type: let the browser pick
    this._rec = rec;
    this._stream = stream;
    this._keep = keep ?? !ondata;
    this._chunks = [];
    this._bytes = 0;
    this._seq = 0;
    this._queue = Promise.resolve();
    this.error = null;
    this._result = null;
    this._size = { width: hasVideo ? w : 0, height: hasVideo ? h : 0 };
    rec.ondataavailable = (e) => {
      if (!e.data || !e.data.size) return;
      const seq = this._seq++;
      this._bytes += e.data.size;
      if (this._keep) this._chunks.push(e.data);
      if (ondata) this._queue = this._queue.then(() => ondata(e.data, seq)).catch((err) => { if (!this.error) this.error = err; });
    };
    rec.onerror = (e) => { this.error = (e && e.error) || e || new Error('MediaRecorder error'); };
    this._stopped = new Promise((res) => { rec.onstop = res; });
    rec.start(timeslice);
    this.t0 = now();
    return this;
  }

  /**
   * Stop and finish. Resolves after the last chunk (and every ondata promise).
   * @returns {Promise<{ mimeType:string, ext:string, bytes:number, chunks:number, durationMs:number,
   *   width:number, height:number, fps:number, audio:boolean, blob:Blob|null, error:any }>}
   */
  async stop() {
    if (this._result) return this._result;
    const rec = this._rec;
    if (!rec) throw new Error('Recorder: not started');
    const durationMs = Math.round(now() - this.t0);
    if (rec.state !== 'inactive') rec.stop();
    await this._stopped;
    await this._queue;
    for (const t of this._own || []) t.stop();
    if (this._mix) { this._mix.close(); this._mix = null; }
    const mimeType = rec.mimeType || this.mimeType || (this.audioOnly ? 'audio/webm' : 'video/webm');
    this._result = {
      mimeType, ext: extFor(mimeType), bytes: this._bytes, chunks: this._seq, durationMs,
      width: this._size.width, height: this._size.height, fps: this.audioOnly ? 0 : this.fps,
      audio: this._stream.getAudioTracks().length > 0,
      blob: this._keep ? new Blob(this._chunks, { type: mimeType }) : null,
      error: this.error,
    };
    this._chunks = [];
    return this._result;
  }
}
