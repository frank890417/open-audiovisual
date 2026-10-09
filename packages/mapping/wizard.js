// @openav/mapping · wizard — "map the knobs in order".
//
// Binding twelve params one by one with the learn chip means twelve clicks and twelve guesses
// about what to touch next. The wizard walks the list for you: it arms learn for the first
// param, you turn one knob, it binds it and arms the next. Skip leaves a param alone, Back
// goes one up, Stop ends it. Learn ADDS routes, it never replaces (Mapper.learn), so running
// the wizard twice puts a second knob on a param instead of losing the first.
//
//   const wiz = new LearnWizard({ mapper, keys: () => params.schema.filter((p) => !p.hidden).map((p) => p.key) });
//   wiz.start();            // arms keys[0]
//   wiz.current;            // 'hue'  — show "Turn a knob for: hue (1/12)"
//   wiz.skip(); wiz.back(); wiz.stop();
//
// Pure logic on top of Mapper: no DOM. The console draws the banner (packages/console).

export class LearnWizard {
  /**
   * @param {object} o
   * @param {import('./index.js?v=a8b6135').Mapper} o.mapper
   * @param {string[]|(()=>string[])} o.keys   the params to bind, in order (read when start() is called)
   * @param {(w: LearnWizard)=>void} [o.onChange]   anything the banner shows changed
   */
  constructor({ mapper, keys, onChange = null }) {
    this.mapper = mapper;
    this._keys = keys;
    this.onChange = onChange;
    this.order = [];
    this.index = 0;
    this.active = false;
    this.done = false;
    this.added = [];             // [{ key, source }] bound during this run
  }

  get total() { return this.order.length; }
  /** The param being waited for, or null. */
  get current() { return this.active ? this.order[this.index] : null; }

  start() {
    const keys = typeof this._keys === 'function' ? this._keys() : this._keys;
    this.order = [...(keys || [])];
    if (!this.order.length) return false;
    this.index = 0; this.added = []; this.done = false; this.active = true;
    this._wrapped = true;
    this._prev = this.mapper.onLearn;
    this.mapper.onLearn = (route, sig) => { try { this._prev?.(route, sig); } finally { this._learned(route, sig); } };
    this._arm();
    this._changed();
    return true;
  }

  /** Leave the current param unbound and wait for the next one. */
  skip() { if (this.active) this._advance(); }
  /** Back to the previous param (it keeps what it already has; a turned knob adds one more). */
  back() {
    if (!this.active || this.index === 0) return;
    this.index--; this._arm(); this._changed();
  }
  /** End the run now. */
  stop() { if (this.active) this._finish(false); }

  /** Call every frame: while the wizard runs it owns learn mode, so a click on some other learn chip cannot leave it waiting for nothing. */
  sync() { if (this.active && this.mapper.learnTarget !== this.current) { this._arm(); this._changed(); } }

  _arm() {
    const key = this.current;
    if (key && this.mapper.learnTarget !== key) this.mapper.learn(key);     // learn() toggles: never call it on the one already armed
  }
  _learned(route, sig) {
    if (!this.active || route.target !== this.current) return;
    this.added.push({ key: route.target, source: sig });
    this._advance();
  }
  _advance() {
    this.index++;
    if (this.index >= this.order.length) return this._finish(true);
    this._arm(); this._changed();
  }
  _finish(done) {
    this.active = false; this.done = done;
    if (this.mapper.learnTarget) this.mapper.learn(this.mapper.learnTarget);   // disarm
    if (this._wrapped) { this.mapper.onLearn = this._prev; this._wrapped = false; }
    this._changed();
  }
  _changed() { try { this.onChange?.(this); } catch (e) { console.error('[learn wizard]', e); } }
}
