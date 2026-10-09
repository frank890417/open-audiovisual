// @openav/timeline — the theatrical spine: param automation + scenes + transport.
//
// Lineage: The Last Input core/timeline.js — drove a full 14-scene IRCAM show.
// Pure logic, no DOM. Feed it params/automation/scenes and it answers one
// question: "what is the state of the world at time t?"
//
//   const tl = new Timeline({ params, automation, scenes, total })
//   tl.state(t)                  // {key: value} for all params at t
//   tl.play()/pause()/seek(t)/jumpScene(±1)/next()/prev()
//   tl.advance(dt)               // call per frame
//   tl.onSceneChange((i, scene, { cause }) => …)   // cue hook (sound, lights, prompts)
//
// automation: { paramKey: [[t, value], …] }  linear interp (step params hold)
// scenes:     [{ id, t, title?, note?, act?, acts?, hold?, cues? }, …]  t may be negative (pre-show standby)
//
// Since the score (@openav/score): pass `score` and the scenes, the total and the start come
// from it. A scene with `hold: true` stops playback at its end until release() / play() / next().
// `layer(key, value, t)` lets segment modules rewrite a param (a performer's override still wins:
// Params.resolve applies overrides after this). `start` is where reset() goes: default 0, a number, or
// 'first' for the first scene (a pre-show standby at -30 s).

/** A hold parks the playhead this far before the boundary, so it still belongs to the segment that is waiting. */
export const HOLD_EPS = 1e-6;

export class Timeline {
  constructor({ params, automation = {}, scenes = [], total = 600, score = null, start = null }) {
    this.params = params;           // Params instance or plain schema array
    this.schema = Array.isArray(params) ? params : params.schema;
    this.automation = automation;
    this.score = score;
    // with a score the structure comes from it, and automation (written once against the root cut) stretches with a derived cut
    this.scenes = score ? score.scenes() : scenes;
    this.total = score ? score.total : total;
    // where reset() rewinds to: 0 unless told (a number, or 'first' = the first scene, e.g. a standby at -30) or the score says
    this.start = start === 'first' ? (this.scenes.length ? this.scenes[0].t : 0) : (start ?? (score ? score.startT : 0));
    this.t = this.start;
    this.playing = false;
    this.holding = false;           // parked at the end of a `hold` scene, waiting for release()
    this.rate = 1;
    this.layer = null;              // (key, value, t) => value — segment modules rewrite params here
    this._lastScene = -1;
    this._holdAt = null;            // { time, index } while holding
    this._sceneCbs = [];
    this._seekCbs = [];
  }

  _autoTime(t) { return this.score ? this.score.baseTime(t) : t; }

  valueAt(key, t = this.t) {
    t = this._autoTime(t);
    const p = this.schema.find(p => p.key === key);
    const kf = this.automation[key];
    if (!kf || !kf.length) return p ? p.def : 0;
    if (t <= kf[0][0]) return kf[0][1];
    if (t >= kf[kf.length - 1][0]) return kf[kf.length - 1][1];
    for (let i = 0; i < kf.length - 1; i++) {
      if (t >= kf[i][0] && t < kf[i + 1][0]) {
        if (p && p.step) return kf[i][1];
        const f = (t - kf[i][0]) / (kf[i + 1][0] - kf[i][0]);
        return kf[i][1] + (kf[i + 1][1] - kf[i][1]) * f;
      }
    }
    return kf[kf.length - 1][1];
  }

  /** Base state for all params at time t (no overrides — Params.resolve applies those). */
  state(t = this.t) {
    const s = {};
    for (const p of this.schema) {
      const v = this.valueAt(p.key, t);
      s[p.key] = this.layer ? this.layer(p.key, v, t) : v;
    }
    return s;
  }

  sceneIndexAt(t = this.t) { let i = 0; for (let k = 0; k < this.scenes.length; k++) if (t >= this.scenes[k].t) i = k; return i; }
  sceneEnd(i) { return i + 1 < this.scenes.length ? this.scenes[i + 1].t : this.total; }
  currentScene(t = this.t) { return this.scenes[this.sceneIndexAt(t)]; }

  /** cb(index, scene, { cause }) — cause: 'play' | 'release' | 'seek' | 'jump' | 'reset' */
  onSceneChange(cb) { this._sceneCbs.push(cb); }
  /** cb(t, kind) when the playhead is moved by hand — kind: 'seek' | 'jump' | 'reset'. Not called while playing. */
  onSeek(cb) { this._seekCbs.push(cb); }
  _checkScene(cause = 'play') {
    const i = this.sceneIndexAt(this.t);
    if (i !== this._lastScene) { this._lastScene = i; this._sceneCbs.forEach(cb => cb(i, this.scenes[i], { cause })); }
  }
  _moved(kind) { for (const cb of this._seekCbs) { try { cb(this.t, kind); } catch (e) { console.error('[timeline] onSeek handler:', e); } } }

  /** Play. Parked at a hold? Then this lets the show go on to the next scene. */
  play() { if (this.holding) { this.release(); return; } this.playing = true; }
  pause() { this.playing = false; }
  toggle() { if (this.playing) this.pause(); else this.play(); return this.playing; }

  /** Move the playhead to t (clamped). Leaving a hold this way releases it. */
  seek(t, cause = 'seek') {
    const lo = this.scenes.length ? Math.min(0, this.scenes[0].t) : 0;   // negative t allowed (standby scenes)
    this.t = Math.max(lo, Math.min(this.total, t));
    this.holding = false; this._holdAt = null;
    this._checkScene(cause);
    this._moved(cause);
  }
  jumpScene(d) { const i = Math.max(0, Math.min(this.scenes.length - 1, this.sceneIndexAt(this.t) + d)); this.seek(this.scenes[i].t, 'jump'); }
  /** → : release a hold (and keep playing), otherwise jump to the next scene. */
  next() { if (this.holding) return this.release(); this.jumpScene(1); return true; }
  /** ← : the previous scene. */
  prev() { this.jumpScene(-1); return true; }
  /** Let a hold go: the next scene starts now and playback continues. false when nothing was holding. */
  release() {
    if (!this.holding) return false;
    const h = this._holdAt;
    this.holding = false; this._holdAt = null;
    this.t = h.time;
    this.playing = true;
    this._checkScene('release');
    return true;
  }
  /** Back to the start (default 0, or `start`): stopped, not holding. */
  reset() {
    this.t = this.start; this.playing = false; this.holding = false; this._holdAt = null; this._lastScene = -1;
    this._moved('reset');
  }

  // the first hold boundary the playhead crosses going from a to b (a < boundary ≤ b)
  _holdBetween(a, b) {
    for (let i = 0; i < this.scenes.length - 1; i++) {
      if (!this.scenes[i].hold) continue;
      const h = this.scenes[i + 1].t;
      if (a < h && h <= b) return { time: h, index: i };
    }
    return null;
  }

  /** Call per frame with clamped dt. Returns whether still playing. */
  advance(dt) {
    if (this.playing) {
      const next = this.t + dt * this.rate;
      const hold = this._holdBetween(this.t, next);
      if (hold) {
        this.t = hold.time - HOLD_EPS;
        this.playing = false; this.holding = true; this._holdAt = hold;
        this._checkScene();
        return false;
      }
      this.t = next;
      if (this.t >= this.total) { this.t = this.total; this.playing = false; }
      this._checkScene();
    }
    return this.playing;
  }
}
