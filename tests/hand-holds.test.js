// Who holds a value when several writers touch it (docs/mapping.md#who-holds-a-value).
//
// Three shows met the same bug on site: a value a person set by hand was undone a frame (or a second) later by something
// that keeps re-pushing. One test per case first, then the rule they add up to, then the way back (writes: 'legacy').
//
//   case 1  an installation: the param sound/volume was pushed into the sound engine every frame (181 times in 3 s on the
//           exhibition machine), so a volume set on the engine "did nothing". Still so in 0.10.0: these tests are red there.
//   case 2  a work: a smoothed knob route re-wrote its param every frame, so the console's ✕ seemed to do nothing. Fixed in
//           8ad22603 (0.9.0: a glide stops writing once it has arrived, and stands down when somebody else wrote the param).
//           Green on 0.10.0; pinned here so it stays fixed.
//   case 3  noted in a review on 2026-11-15: after ✕, a source that re-sends the same value puts the route back. The
//           relay does exactly that for every phone control, once a second. Still so in 0.10.0: red there.
//
// No browser and no real time: a show runs on a fake page with loop: 'manual' (tests/_fakepage.js), a frame is 1/60 s.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Signals } from '../packages/core/src/signals.js';
import { Params } from '../packages/core/src/params.js';
import { Mapper } from '../packages/mapping/index.js';
import { Sound } from '../packages/sound/index.js';
import { RelayClient, bindSignals } from '../packages/relay/index.js';
import { onFakeShow } from './_fakepage.js';

globalThis.performance ??= { now: () => Date.now() };
const close = (a, b, eps = 1e-6, what = '') => assert.ok(Math.abs(a - b) <= eps, `${what} expected ${b}, got ${a}`);

/** A sound engine that writes down every set(): what the field machine's player did, minus the sound. */
function countingEngine() {
  const e = {
    calls: [], value: {},
    params: [{ key: 'volume', label: 'Volume (dB)', min: -36, max: 0, def: 0 }, { key: 'cutoff', min: 100, max: 8000, def: 2500 }],
    async enable() {}, noteOn() {}, noteOff() {}, dispose() {},
    set(k, v) { e.calls.push([k, v]); e.value[k] = v; },
    count: (k) => e.calls.filter((c) => c[0] === k).length,
  };
  return e;
}

/** A phone on the relay and the show page that hears it, in memory: the phone's 1 Hz re-send is resend(). */
function phoneTo(signals) {
  const page = new RelayClient({ role: 'runner', id: 'show' });
  bindSignals(page, signals);
  const phone = new RelayClient({ role: 'controller', id: 'p1' });
  phone._ws = { readyState: 1, send: (raw) => page._onMessage(raw) };
  return {
    move(name, v) { phone.set(name, v); phone._flush(false); },     // a finger on the fader: the 30 Hz batch
    resend() { phone._flush(true); },                                 // nobody touches it: the once-a-second refresh
  };
}

/** bloom 0..100 (def 10); the timeline says 40. */
function rig(opts = {}) {
  const signals = new Signals();
  const params = new Params([{ key: 'bloom', min: 0, max: 100, def: 10 }, { key: 'mode', min: 0, max: 3, def: 0, step: 1 }]);
  const axis = { bloom: 40, mode: 1 };
  const mapper = new Mapper({ signals, params, base: () => axis, ...opts });
  const out = (k = 'bloom') => params.resolve(axis)[k];
  const frames = (seconds, each) => { for (let n = Math.round(seconds * 60), i = 0; i < n; i++) { if (each && i % 60 === 59) each(); mapper.update(1 / 60); } };
  return { signals, params, axis, mapper, out, frames };
}

// ───────────── case 1 · the per-frame push into the sound engine ─────────────

test('case 1 · a still sound/* param reaches the engine once, not every frame: 3 s at 60 fps is one set(), not 180', async () => {
  const engine = countingEngine();
  await onFakeShow({ world: { name: 'hall', params: [] }, timeline: { total: 60 }, modules: { sound: { engine } } }, async (show, step) => {
    await show.sound.enable();
    step(180);
    assert.equal(engine.count('volume'), 1, '0.10.0 pushed it every frame: 180 here, 181 in 3 s on the field machine');
    assert.equal(engine.value.volume, 0);
  });
});

test('case 1 · a value written straight into the engine is not overwritten on the next frame', async () => {
  const engine = countingEngine();
  await onFakeShow({ world: { name: 'hall', params: [] }, timeline: { total: 60 }, modules: { sound: { engine } } }, async (show, step) => {
    await show.sound.enable();
    step(2);
    show.sound.engine.set('volume', -20);                   // what the installation did
    step(180);
    assert.equal(engine.value.volume, -20, '0.10.0: back to 0 dB on the next frame');
  });
});

test('case 1 · sound.set() holds an engine value: the timeline\'s automation, a smoothed knob and a re-sent value cannot undo it; ✕ (sound.release) gives it back', async () => {
  const engine = countingEngine();
  const show = { world: { name: 'hall', params: [] }, timeline: { total: 10, automation: { 'sound/volume': [[0, 0], [10, -30]] } },
    routes: [{ source: 'k', target: 'sound/volume', outMin: -36, outMax: 0, smooth: 0.2 }], modules: { sound: { engine } } };
  await onFakeShow(show, async (s, step) => {
    await s.sound.enable();
    s.timeline.play();
    step(30);
    close(engine.value.volume, s.timeline.valueAt('sound/volume'), 1e-9, 'the engine follows the automation while nobody holds it');
    s.signals.set('k', 0.5); step(60);
    assert.equal(s.params.holder('sound/volume').kind, 'route', 'the knob took it');
    s.sound.set('volume', -20);                             // the framework's own setter: a hand
    assert.equal(engine.value.volume, -20, 'at once');
    assert.deepEqual(s.params.holder('sound/volume'), { kind: 'hand', label: 'sound.set', value: -20 });
    const before = engine.calls.length;
    for (let i = 0; i < 4; i++) { s.signals.set('k', 0.5); step(60); }   // the timeline keeps moving, the knob re-sends the same value
    assert.equal(engine.value.volume, -20);
    assert.equal(engine.calls.length, before, 'nothing was pushed: the param did not change');
    assert.equal(s.params.overrides['sound/volume'], -20);
    s.sound.release('volume');                              // = ✕ on sound/volume
    step(1);
    close(engine.value.volume, s.timeline.valueAt('sound/volume'), 1e-9, 'the automation plays again');
    s.signals.set('k', 0.9); step(120);
    close(engine.value.volume, -36 + 36 * 0.9, 0.05, 'moving the knob takes it again');
  });
});

// ───────────── case 2 · a smoothed route and the console's ✕ ─────────────

test('case 2 · ✕ on a param a smoothed knob holds gives it back to the timeline, and it stays back (fixed in 8ad22603, 0.9.0)', async () => {
  const world = { name: 'garden', params: [{ key: 'glow', min: 0, max: 1, def: 0 }] };
  await onFakeShow({ world, timeline: { total: 10, automation: { glow: [[0, 0.2], [10, 0.8]] } }, routes: [{ source: 'k', target: 'glow', smooth: 0.2 }] }, async (s, step) => {
    s.timeline.play();
    s.signals.set('k', 0.9); step(90);
    close(s.params.overrides.glow, 0.9, 1e-3, 'the knob arrived');
    s.params.clearOverride('glow');                         // what ✕ on the Params panel does (packages/console/src/params-panel.js)
    step(120);
    assert.equal(s.params.isOverridden('glow'), false, 'before 0.9.0 the glide wrote it back the next frame');
    close(s.params.resolve(s.timeline.state()).glow, s.timeline.valueAt('glow'), 1e-9);
    s.signals.set('k', 0.1); step(6);                       // a new move, a slow glide, ✕ in the middle of it
    assert.equal(s.params.isOverridden('glow'), true);
    s.params.clearOverride('glow'); step(120);
    assert.equal(s.params.isOverridden('glow'), false, '✕ mid-glide stops the glide');
  });
});

// ───────────── case 3 · a source that re-sends the same value ─────────────

for (const [name, route, again] of [
  ['override', {}, 0.6],
  ['smooth', { smooth: 0.1 }, 0.6],
  ['trim', { mode: 'trim', outMin: -20, outMax: 20 }, 0.3],
  ['pickup', { mode: 'pickup' }, 0.4],
]) {
  test(`case 3 · ${name}: after ✕, a phone fader nobody touches (the relay re-sends it once a second) does not take the param back; moving it does`, () => {
    const { signals, params, mapper, out, frames } = rig();
    const phone = phoneTo(signals);
    mapper.addRoute({ source: 'surface/main/bloom', target: 'bloom', ...route });
    if (name === 'pickup') phone.move('surface/main/bloom', 0.4);   // a pickup knob has to meet 40 first
    phone.move('surface/main/bloom', 0.8); frames(1);
    assert.equal(params.isOverridden('bloom'), true, 'the phone holds it');
    params.clearOverride('bloom');                          // ✕
    frames(3, () => phone.resend());
    assert.equal(params.isOverridden('bloom'), false, '0.10.0: the next re-send put it back');
    close(out(), 40, 1e-9, 'the timeline plays');
    phone.move('surface/main/bloom', again); frames(1);
    assert.equal(params.isOverridden('bloom'), true, 'a real move takes it again');
  });
}

test('case 3 · a value set by hand is not taken back by a re-sent value either, even the very number the route had written', () => {
  for (const smooth of [0, 0.3]) {
    const { signals, params, mapper, frames } = rig();
    const phone = phoneTo(signals);
    mapper.addRoute({ source: 'surface/main/bloom', target: 'bloom', smooth });
    phone.move('surface/main/bloom', 0.8); frames(2);
    params.override('bloom', 25);                           // the console's slider
    frames(3, () => phone.resend());
    assert.equal(params.overrides.bloom, 25, `smooth ${smooth}: the slider keeps it`);
    signals.set('surface/main/bloom', 0.8); frames(1);       // a source that sends the same number again (OSC does)
    assert.equal(params.overrides.bloom, 25, `smooth ${smooth}: the same reading again is no move`);
  }
});

test('case 3 · a hand writing the very value a glide is passing through still stops the glide (0.10.0 compared values and missed it)', () => {
  const { signals, params, mapper } = rig();
  mapper.addRoute({ source: 'k', target: 'mode', smooth: 1 });   // a stepped param: the glide sits on 1, 2, 3 for many frames
  signals.set('k', 1);
  for (let i = 0; i < 30; i++) mapper.update(1 / 60);
  const v = params.overrides.mode;
  assert.ok(v < 3, `still gliding (${v})`);
  params.override('mode', v);                               // the operator takes it where it is
  for (let i = 0; i < 300; i++) mapper.update(1 / 60);
  assert.equal(params.overrides.mode, v, 'the glide did not carry on to 3');
  assert.equal(params.holder('mode').kind, 'hand');
});

test('case 3 · a hand that writes between a knob\'s move and the next frame wins: the order is the order things happened', () => {
  const { signals, params, mapper } = rig();
  mapper.addRoute({ source: 'k', target: 'bloom', smooth: 0.2 });
  signals.set('k', 0.9);                                    // the knob moves: the glide starts on the next update()
  params.override('bloom', 15);                             // then the slider, before that frame
  for (let i = 0; i < 120; i++) mapper.update(1 / 60);
  assert.equal(params.overrides.bloom, 15);
});

test('case 3 · a route added while a hand holds its param (learned, imported, loaded) waits for its source to change', () => {
  const { signals, params, mapper, frames } = rig();
  const phone = phoneTo(signals);
  params.override('bloom', 25);
  mapper.importMap({ format: 'openav.map', version: 1, routes: [{ signal: 'surface/main/bloom', param: 'bloom', range: { in: [0, 1], out: [0, 100] } }] });
  frames(3, () => phone.resend());                          // nothing yet: the relay has no value for it
  phone.move('surface/main/bloom', 0.8);                    // the first value the new route hears: where the fader already was
  frames(3, () => phone.resend());
  assert.equal(params.overrides.bloom, 25, 'the first reading only tells the route where the fader is');
  phone.move('surface/main/bloom', 0.7); frames(1);
  assert.equal(params.overrides.bloom, 70, 'a move takes it');
  assert.equal(params.holder('bloom').kind, 'route');
});

// ───────────── the rule: who holds a value, and what a re-pusher may do ─────────────

test('holder(): null while the timeline plays; a hand for the slider and override(); the route, with its source, for the mapper; a value put straight into params.overrides counts as a hand', () => {
  const { signals, params, mapper } = rig();
  assert.equal(params.holder('bloom'), null);
  params.override('bloom', 30);
  assert.deepEqual(params.holder('bloom'), { kind: 'hand', label: 'hand', value: 30 });
  params.hold('bloom', 31, 'piano');
  assert.deepEqual(params.holder('bloom'), { kind: 'hand', label: 'piano', value: 31 });
  params.clearOverride('bloom');
  assert.equal(params.holder('bloom'), null);
  mapper.addRoute({ source: 'midi/cc/74', target: 'bloom' });
  mapper.addRoute({ source: 'midi/cc/75', target: 'bloom', mode: 'trim', outMin: -10, outMax: 10 });
  signals.set('midi/cc/74', 0.5); signals.set('midi/cc/75', 1);
  const h = params.holder('bloom');
  assert.equal(h.kind, 'route'); assert.equal(h.source, 'midi/cc/74'); assert.equal(h.label, 'midi/cc/74 + trim midi/cc/75'); assert.equal(h.value, 60);
  params.overrides.bloom = 12;                              // older code writes the object itself
  assert.deepEqual(params.holder('bloom'), { kind: 'hand', label: 'hand', value: 12 });
  assert.equal(params.holder('bloom'), params.holder('bloom'), 'the same record until the next write');
  params.hold('nope', 1); params.override('nope', 1);
  assert.equal(params.holder('nope'), null, 'an unknown key is still ignored');
});

test('the desk says who holds it: heldText()', async () => {
  const { heldText } = await import('../packages/console/src/params-panel.js');
  assert.equal(heldText(null), 'the timeline');
  assert.equal(heldText({ kind: 'hand', label: 'hand' }), 'hand');
  assert.equal(heldText({ kind: 'hand', label: 'sound.set' }), 'sound.set');
  assert.equal(heldText({ kind: 'route', label: 'pickup midi/cc/71', source: 'midi/cc/71' }), 'route pickup midi/cc/71');
});

test('a re-pusher writes only when its own value changed: a trim riding a still timeline writes once, then again when the timeline moves', () => {
  const { signals, params, mapper, axis } = rig();
  mapper.addRoute({ source: 'k', target: 'bloom', mode: 'trim', outMin: -20, outMax: 20 });
  let writes = 0;
  const hold = params.hold.bind(params);
  params.hold = (...a) => { writes++; return hold(...a); };
  signals.set('k', 1);
  for (let i = 0; i < 120; i++) mapper.update(1 / 60);
  assert.equal(writes, 1, 'two seconds of a still knob on a still timeline: one write (0.10.0: one per frame)');
  axis.bloom = 50; mapper.update(1 / 60);
  assert.equal(writes, 2);
  assert.equal(params.overrides.bloom, 70);
});

test('a sound engine hears every value again when the instrument changes and when it is enabled again, so a new voice never starts on its defaults', async () => {
  const subs = new Set();
  const e = countingEngine();
  Object.assign(e, {
    instrument: 'a', hasInstrument: () => true,
    subscribe: (cb) => { subs.add(cb); return () => subs.delete(cb); },
    async setInstrument(id) { e.instrument = id; for (const cb of subs) cb({ type: 'instrument', id }); return true; },
  });
  const sound = new Sound({ signals: new Signals(), params: new Params(), engine: e, remember: false });
  const state = { 'sound/volume': -6, 'sound/cutoff': 1200 };
  await sound.enable();
  sound.update(state); sound.update(state);
  assert.equal(e.calls.length, 2, 'each value once');
  await sound.setInstrument('b');
  sound.update(state);
  assert.equal(e.calls.length, 4, 'the new instrument hears both again');
  sound.update(state);
  assert.equal(e.calls.length, 4, 'and then only changes');
  sound.dispose(); await sound.enable();
  sound.update(state);
  assert.equal(e.calls.length, 6, 'an engine enabled again hears every value again');
});

// ───────────── the way back: writes: 'legacy' ─────────────

test('writes: "legacy" is 0.10.0 again, on createShow, Mapper and Sound alike, with one deprecation warning; a value it does not know throws', async () => {
  const warns = [];
  const warn = console.warn;
  console.warn = (...a) => warns.push(a.join(' '));
  try {
    // Mapper: after ✕ the next re-sent reading takes the param back; a hand writing the passing value does not stop a glide
    const a = rig({ writes: 'legacy' });
    assert.equal(a.mapper.writes, 'legacy');
    const phone = phoneTo(a.signals);
    a.mapper.addRoute({ source: 'surface/main/bloom', target: 'bloom' });
    phone.move('surface/main/bloom', 0.8); a.frames(1);
    a.params.clearOverride('bloom');
    a.frames(1.5, () => phone.resend());
    assert.equal(a.params.overrides.bloom, 80, 'legacy: put back by the re-send');
    const b = rig({ writes: 'legacy' });
    b.mapper.addRoute({ source: 'k', target: 'mode', smooth: 1 });
    b.signals.set('k', 1);
    for (let i = 0; i < 30; i++) b.mapper.update(1 / 60);
    b.params.override('mode', b.params.overrides.mode);
    for (let i = 0; i < 300; i++) b.mapper.update(1 / 60);
    assert.equal(b.params.overrides.mode, 3, 'legacy: the glide carries on');

    // Sound: every sound/* value, every frame
    const e1 = countingEngine();
    const s1 = new Sound({ signals: new Signals(), params: new Params(), engine: e1, remember: false, writes: 'legacy' });
    await s1.enable();
    for (let i = 0; i < 180; i++) s1.update({ 'sound/volume': 0, 'sound/cutoff': 2500 });
    assert.equal(e1.count('volume'), 180);

    // createShow: the field installation's numbers, and the engine value overwritten on the next frame
    const engine = countingEngine();
    await onFakeShow({ world: { name: 'hall', params: [] }, timeline: { total: 60 }, modules: { sound: { engine } }, writes: 'legacy' }, async (show, step) => {
      assert.equal(show.mapper.writes, 'legacy'); assert.equal(show.sound.writes, 'legacy');
      await show.sound.enable();
      step(180);
      assert.equal(engine.count('volume'), 180);
      show.sound.engine.set('volume', -20); step(1);
      assert.equal(engine.value.volume, 0, 'legacy: overwritten on the next frame');
    });
    assert.equal(warns.length, 1, `one warning for the whole page, got ${warns.length}`);
    assert.match(warns[0], /'legacy'/); assert.match(warns[0], /deprecated/); assert.match(warns[0], /mapping\.md/);
  } finally { console.warn = warn; }

  for (const bad of ['hand', 'Legacy', true, 0, {}]) {
    assert.throws(() => new Mapper({ signals: new Signals(), params: new Params(), writes: bad }), /new Mapper\(\{ writes \}\) must be 'hold' \(the default\) or 'legacy'/, String(bad));
    assert.throws(() => new Sound({ signals: new Signals(), engine: countingEngine(), writes: bad }), /new Sound\(\{ writes \}\) must be/);
  }
  await assert.rejects(() => onFakeShow({ world: { name: 'x', params: [] }, writes: 'nope' }, async () => {}), /createShow\(\{ writes \}\) must be 'hold'/);
  assert.equal(new Mapper({ signals: new Signals(), params: new Params() }).writes, 'hold', 'the default');
});

/** A small deterministic random source (the same script on every run). */
function prng(seed) { let x = seed >>> 0; return () => ((x = (Math.imul(x, 1664525) + 1013904223) >>> 0) / 2 ** 32); }

test('with no hand in the way, 0.11.0 writes what 0.10.0 wrote, frame for frame: knobs, glides, trims, pickup, release, mutes, re-sends', () => {
  for (const seed of [1, 7, 42]) {
    const rnd = prng(seed);
    const mk = (writes) => {
      const signals = new Signals();
      const params = new Params([{ key: 'bloom', min: 0, max: 100, def: 10 }, { key: 'hue', min: 0, max: 360, def: 0 }, { key: 'mode', min: 0, max: 3, def: 0, step: 1 }]);
      const axis = { bloom: 40, hue: 180, mode: 1 };
      const mapper = new Mapper({ signals, params, base: () => axis, writes });
      for (const r of [
        { source: 'a', target: 'bloom' }, { source: 'b', target: 'bloom', smooth: 0.15 },
        { source: 'c', target: 'hue', mode: 'trim', smooth: 0.1, release: 1.5 }, { source: 'd', target: 'hue', mode: 'pickup', release: 2 },
        { source: 'e', target: 'mode', smooth: 0.3 }, { source: 'f', target: 'bloom', mode: 'trim', outMin: -5, outMax: 5, release: 0.5 },
      ]) mapper.addRoute(r);
      return { signals, params, axis, mapper, last: {} };
    };
    const hold = mk('hold'), legacy = mk('legacy');
    for (let f = 0; f < 60 * 20; f++) {
      const t = f / 60, ev = rnd(), src = 'abcdef'[Math.floor(rnd() * 6)], v = Math.round(rnd() * 127) / 127, mute = rnd() < 0.003;
      for (const x of [hold, legacy]) {
        x.axis.bloom = 40 + 20 * Math.sin(t); x.axis.hue = 180 + 90 * Math.sin(0.3 * t); x.axis.mode = t % 8 < 4 ? 1 : 2;
        if (ev < 0.08) { x.signals.set(src, v); x.last[src] = v; }                        // a move
        else if (ev < 0.12 && src in x.last) x.signals.set(src, x.last[src]);             // a re-send of the same reading
        if (mute) { const r = x.mapper.routes[Math.floor((f * 7) % 6)]; r.enabled = r.enabled === false; }
        x.mapper.update(1 / 60);
      }
      assert.deepEqual(hold.params.resolve(hold.axis), legacy.params.resolve(legacy.axis), `seed ${seed}, frame ${f}`);
      assert.deepEqual(Object.keys(hold.params.overrides).sort(), Object.keys(legacy.params.overrides).sort(), `seed ${seed}, frame ${f}: the same params overridden`);
    }
  }
});

test('the sound engine ends every frame in the same state whether it is told every value (legacy) or only the changes', async () => {
  const rnd = prng(3);
  const a = countingEngine(), b = countingEngine();
  const sa = new Sound({ signals: new Signals(), params: new Params(), engine: a, remember: false });
  const sb = new Sound({ signals: new Signals(), params: new Params(), engine: b, remember: false, writes: 'legacy' });
  await sa.enable(); await sb.enable();
  const state = { 'sound/volume': 0, 'sound/cutoff': 2500, hue: 0 };
  for (let f = 0; f < 600; f++) {
    if (rnd() < 0.1) state['sound/volume'] = -Math.round(rnd() * 36);
    if (rnd() < 0.05) state['sound/cutoff'] = 100 + Math.round(rnd() * 7900);
    sa.update(state); sb.update(state);
    assert.deepEqual(a.value, b.value, `frame ${f}`);
  }
  assert.ok(a.calls.length < b.calls.length / 5, `${a.calls.length} calls instead of ${b.calls.length}`);
});
