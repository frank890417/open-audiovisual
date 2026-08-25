// @openav/timeline — the theatrical spine: param automation + scenes + transport.
//
// Lineage: The Last Input core/timeline.js — drove a full 14-scene IRCAM show.
// Pure logic, no DOM. Feed it params/automation/scenes and it answers one
// question: "what is the state of the world at time t?"
//
//   const tl = new Timeline({ params, automation, scenes, total })
//   tl.state(t)                  // {key: value} for all params at t
//   tl.play()/pause()/seek(t)/jumpScene(±1)
//   tl.advance(dt)               // call per frame
//   tl.onSceneChange((i, scene) => …)   // cue hook (sound, lights, prompts)
//
// automation: { paramKey: [[t, value], …] }  linear interp (step params hold)
// scenes:     [{ id, t, title?, note?, act? }, …]  t may be negative (pre-show standby)

export class Timeline {
  constructor({ params, automation = {}, scenes = [], total = 600 }) {
    this.params = params;           // Params instance or plain schema array
    this.schema = Array.isArray(params) ? params : params.schema;
    this.automation = automation;
    this.scenes = scenes;
    this.total = total;
    this.t = 0;
    this.playing = false;
    this.rate = 1;
    this._lastScene = -1;
    this._sceneCbs = [];
  }

  valueAt(key, t = this.t) {
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
    for (const p of this.schema) s[p.key] = this.valueAt(p.key, t);
    return s;
  }

  sceneIndexAt(t = this.t) { let i = 0; for (let k = 0; k < this.scenes.length; k++) if (t >= this.scenes[k].t) i = k; return i; }
  sceneEnd(i) { return i + 1 < this.scenes.length ? this.scenes[i + 1].t : this.total; }
  currentScene(t = this.t) { return this.scenes[this.sceneIndexAt(t)]; }

  onSceneChange(cb) { this._sceneCbs.push(cb); }
  _checkScene() {
    const i = this.sceneIndexAt(this.t);
    if (i !== this._lastScene) { this._lastScene = i; this._sceneCbs.forEach(cb => cb(i, this.scenes[i])); }
  }

  play() { this.playing = true; }
  pause() { this.playing = false; }
  toggle() { this.playing = !this.playing; return this.playing; }
  seek(t) {
    const lo = this.scenes.length ? Math.min(0, this.scenes[0].t) : 0;   // negative t allowed (standby scenes)
    this.t = Math.max(lo, Math.min(this.total, t));
    this._checkScene();
  }
  jumpScene(d) { const i = Math.max(0, Math.min(this.scenes.length - 1, this.sceneIndexAt(this.t) + d)); this.seek(this.scenes[i].t); }
  reset() { this.t = 0; this.playing = false; this._lastScene = -1; }

  /** Call per frame with clamped dt. Returns whether still playing. */
  advance(dt) {
    if (this.playing) {
      this.t += dt * this.rate;
      if (this.t >= this.total) { this.t = this.total; this.playing = false; }
      this._checkScene();
    }
    return this.playing;
  }
}
