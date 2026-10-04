// The homepage instrument — open-audiovisual assembled by hand, in the open.
//
//   input    @openav/keys (on-screen piano · QWERTY · SimPlayer) + the stage itself
//            (pointer) + optional MIDI / mic, all publishing SIGNALS
//   analyze  @openav/chord turns held notes into chord/* signals
//   mapping  @openav/mapping routes signals → PARAMS (the patch bay draws these routes)
//   world    ./harmonograph.js, an ordinary World run by @openav/stage
//   output   the canvas, and @openav/sound (Tone.js) when you switch Sound on
//
// No build step: this file is served as-is, imports resolve through the page's import map.

import { Signals, Params, Loop } from '@openav/core';
import { Mapper } from '@openav/mapping';
import { Stage } from '@openav/stage';
import { KeysPiano, SimPlayer } from '@openav/keys';
import { ChordDetector } from '@openav/chord';
import { harmonograph } from './harmonograph.js?v=0249f81';

const T = (() => { try { return JSON.parse(document.getElementById('oav-i18n').textContent); } catch (e) { return {}; } })();
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const NAMES = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'];
const noteName = (n) => NAMES[((n % 12) + 12) % 12] + (Math.floor(n / 12) - 1);
const clamp01 = (x) => Math.min(1, Math.max(0, x));
// chord shapes (as in @openav/chord) — only to NAME the root of an inversion in the readout
const SHAPES = { major: [0, 4, 7], minor: [0, 3, 7], sus4: [0, 5, 7], sus2: [0, 2, 7], dim: [0, 3, 6], aug: [0, 4, 8],
  maj7: [0, 4, 7, 11], min7: [0, 3, 7, 10], dom7: [0, 4, 7, 10], halfdim7: [0, 3, 6, 10], maj9: [0, 2, 4, 7, 11],
  min9: [0, 2, 3, 7, 10], dom9: [0, 2, 4, 7, 10], six: [0, 4, 7, 9], min6: [0, 3, 7, 9] };
const chordRoot = (a) => {
  const shape = SHAPES[a.chordType], pcs = a.pcs || [];
  if (shape) for (const r of pcs) {
    const rel = pcs.map((p) => (p - r + 12) % 12).sort((x, y) => x - y);
    if (rel.length === shape.length && rel.every((v, i) => v === shape[i])) return r;
  }
  return ((a.root % 12) + 12) % 12;
};

wireCopyButtons();
wireLanguageSwitch();
const inst = document.getElementById('instrument');
if (inst) instrument(inst).catch((e) => console.error('[home] instrument:', e));

async function instrument(inst) {
  // ---------- core: two currencies ----------
  const signals = new Signals();
  const params = new Params();
  signals.define('pointer/x', { min: 0, max: 1, source: 'pointer', description: 'stage x, 0 = left' });
  signals.define('pointer/y', { min: 0, max: 1, source: 'pointer', description: 'stage y, 1 = top' });
  signals.define('midi/cc/1', { min: 0, max: 1, source: 'midi', description: 'mod wheel' });
  signals.define('audio/rms', { min: 0, max: 1, source: 'audio' });
  signals.define('midi/note/on', { kind: 'pulse', source: 'keys' });
  signals.define('midi/note/off', { kind: 'pulse', source: 'keys' });

  // L1.5 analyzer: held notes → one chord event per gesture (+ continuous chord/consonance)
  const chord = new ChordDetector({ signals });
  signals.on('midi/note/on', ({ note, vel }) => chord.noteOn(note, vel ?? 0.8));
  signals.on('midi/note/off', ({ note }) => chord.noteOff(note));

  // ---------- L3: the world ----------
  const stageEl = document.getElementById('stage');
  const stage = new Stage({ container: stageEl, params, signals });
  const world = harmonograph({ reduced });
  stage.register(world);
  await stage.activate(world.name);

  // ---------- L2: routes are data; the patch bay below is drawn from them ----------
  const mapper = new Mapper({ signals, params, profile: 'home' });
  mapper.addRoute({ source: 'chord/consonance', target: 'order', inMin: -1, inMax: 1, curve: 'smooth', smooth: 0.6 });
  mapper.addRoute({ source: 'pointer/x', target: 'hue', smooth: 0.25 });
  mapper.addRoute({ source: 'pointer/y', target: 'twist', smooth: 0.3 });
  mapper.addRoute({ source: 'midi/cc/1', target: 'twist', smooth: 0.1 });            // two sources, one param
  mapper.addRoute({ source: 'audio/rms', target: 'energy', inMin: 0, inMax: 0.25, smooth: 0.12 });

  // ---------- L1: keys, the simulated performer, the stage as a surface ----------
  const keysEl = document.getElementById('keys');
  const emit = (note, vel, on) => on
    ? signals.pulse('midi/note/on', { note, vel, ch: 0 })
    : signals.pulse('midi/note/off', { note, ch: 0 });
  let piano = null, layoutKey = '';
  const buildPiano = () => {
    const w = keysEl.clientWidth;
    const [base, semitones] = w < 560 ? [60, 13] : w < 980 ? [48, 25] : [48, 37];
    const key = base + '/' + semitones;
    if (key === layoutKey) return false;
    layoutKey = key;
    piano?.releaseAll();
    keysEl.innerHTML = '';
    piano = new KeysPiano(keysEl, { base, semitones, fill: true, velocity: 96, onNote: emit });
    return true;
  };
  buildPiano();

  const sim = new SimPlayer({ press: (n, v) => piano.press(n, v), release: (n) => piano.release(n), base: 60, density: 0.8 });

  const statusText = document.getElementById('status-text');
  let baseStatus = T.statusIdle, statusTimer = 0, userTook = false;
  const status = (msg, transient = false) => {
    if (!statusText) return;
    if (!transient) baseStatus = msg;
    statusText.textContent = msg;
    clearTimeout(statusTimer);
    if (transient) statusTimer = setTimeout(() => { statusText.textContent = baseStatus; }, 4200);
  };
  const sw = (name) => inst.querySelector(`.sw[data-sw="${name}"]`);
  const setSw = (name, on) => { const b = sw(name); if (b) { b.setAttribute('aria-pressed', on ? 'true' : 'false'); delete b.dataset.busy; } };
  const setAuto = (on) => {
    sim.toggle(on);
    setSw('auto', on);
    inst.dataset.who = on ? 'sim' : (userTook ? 'you' : '');
    status(on ? T.statusSim : (userTook ? T.statusYou : T.statusIdle));
  };
  // the moment a person plays, the simulated performer steps aside
  const userPlayed = () => {
    if (userTook && !sim.enabled) return;
    userTook = true;
    if (sim.enabled) sim.toggle(false);
    setSw('auto', false);
    inst.dataset.who = 'you';
    status(T.statusYou);
  };

  inst.addEventListener('pointerdown', (e) => {
    if (!e.target.closest('button, a')) inst.focus({ preventScroll: true });
    if (e.target.closest('#keys')) userPlayed();
  }, true);
  inst.addEventListener('keydown', (e) => {
    if (e.target.closest('button') && (e.key === ' ' || e.key === 'Enter')) return;
    if (piano.handleKeyDown(e)) { e.preventDefault(); userPlayed(); }
  });
  inst.addEventListener('keyup', (e) => piano.handleKeyUp(e));
  inst.addEventListener('focusout', (e) => { if (!inst.contains(e.relatedTarget)) piano.releaseAll(); });

  // the stage is playable too: x picks a pentatonic note, y is how hard; drag = glissando
  const PENTA = [0, 2, 4, 7, 9];
  const noteAt = (x) => { const i = Math.min(14, Math.floor(x * 15)); return 48 + 12 * Math.floor(i / 5) + PENTA[i % 5]; };
  const at = (e) => { const r = stageEl.getBoundingClientRect(); return [clamp01((e.clientX - r.left) / r.width), clamp01(1 - (e.clientY - r.top) / r.height)]; };
  let held = null, dragging = false;
  const move = (x, y) => { signals.set('pointer/x', x); signals.set('pointer/y', y); };
  stageEl.addEventListener('pointerdown', (e) => {
    dragging = true;
    stageEl.setPointerCapture?.(e.pointerId);
    const [x, y] = at(e); move(x, y);
    held = noteAt(x); piano.press(held, 0.35 + 0.6 * y);
    userPlayed();
  });
  stageEl.addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'mouse' && !dragging) return;
    const [x, y] = at(e); move(x, y);
    if (dragging) { const n = noteAt(x); if (n !== held) { piano.release(held); held = n; piano.press(n, 0.35 + 0.6 * y); } }
  });
  const lift = () => { dragging = false; if (held !== null) { piano.release(held); held = null; } };
  stageEl.addEventListener('pointerup', lift);
  stageEl.addEventListener('pointercancel', lift);

  // ---------- switches: autoplay, and the optional devices ----------
  let sound = null, midi = null, audio = null;
  const devices = { midi: false, mic: false };
  inst.querySelector('.switches')?.addEventListener('click', async (e) => {
    const b = e.target.closest('.sw'); if (!b) return;
    const name = b.dataset.sw, on = b.getAttribute('aria-pressed') === 'true';
    if (name === 'auto') { setAuto(!on); return; }
    if (name === 'sound') {
      if (on) { sound?.dispose(); sound = null; setSw('sound', false); return; }
      b.dataset.busy = ''; status(T.soundLoading, true);
      try {
        const { Sound, toneEngine } = await import('@openav/sound');
        sound = new Sound({ signals, params, engine: toneEngine() });
        await sound.enable();
        setSw('sound', true); status(T.soundOn, true);
      } catch (err) { console.warn('[home] sound:', err); sound = null; setSw('sound', false); }
      return;
    }
    if (name === 'midi') {
      if (on) { for (const i of midi?.inputs || []) i.onmidimessage = null; midi = null; setDevice('midi', false); setSw('midi', false); return; }
      b.dataset.busy = '';
      try {
        const { Midi } = await import('@openav/midi');
        midi = new Midi({ signals });
        const ok = await midi.enable();
        const n = ok ? midi.inputs.length : 0;
        if (!n) { status(T.midiNone, true); setSw('midi', false); return; }
        setDevice('midi', true); setSw('midi', true); status(T.midiOn.replace('{n}', n), true);
        midi.onDevices?.((d) => setDevice('midi', d.length > 0));
      } catch (err) { console.warn('[home] midi:', err); status(T.midiNone, true); setSw('midi', false); }
      return;
    }
    if (name === 'mic') {
      if (on) { audio?.source?.mediaStream?.getTracks().forEach((t) => t.stop()); audio?.ctx?.close(); audio = null; setDevice('mic', false); setSw('mic', false); return; }
      b.dataset.busy = '';
      try {
        const { AudioAnalyzer } = await import('@openav/audio');
        audio = new AudioAnalyzer({ signals });
        await audio.enableMic();
        setDevice('mic', true); setSw('mic', true); status(T.micOn, true);
      } catch (err) { console.warn('[home] mic:', err); audio = null; status(T.micDenied, true); setSw('mic', false); }
    }
  });

  // ---------- the patch bay: wires drawn from mapper.routes ----------
  const bay = document.getElementById('bay');
  const svg = document.getElementById('bay-wires');
  const srcLi = new Map([...bay.querySelectorAll('[data-sig]')].map((li) => [li.dataset.sig, li]));
  const dstLi = new Map([...bay.querySelectorAll('[data-param]')].map((li) => [li.dataset.param, li]));
  const deviceOf = (sig) => srcLi.get(sig)?.dataset.device || null;
  const wires = [
    { src: 'midi/note/on', dst: '@world', event: true },                 // the world subscribes to this event itself
    ...mapper.routes.map((r) => ({ src: r.source, dst: r.target })),
  ].map((w) => ({ ...w, act: 0, off: 0, last: null, flow: null, g: null }));
  const NS = 'http://www.w3.org/2000/svg';
  function layoutWires() {
    const box = svg.getBoundingClientRect();
    const c = (el) => { const r = el.querySelector('.jack').getBoundingClientRect(); return [r.left + r.width / 2 - box.left, r.top + r.height / 2 - box.top]; };
    svg.textContent = '';
    let gx1 = 0, gx2 = 1;
    const defs = document.createElementNS(NS, 'defs');
    const grad = document.createElementNS(NS, 'linearGradient');
    grad.id = 'wire-grad'; grad.setAttribute('gradientUnits', 'userSpaceOnUse');
    for (const [o, col] of [[0, '#4fd08a'], [1, '#ffd166']]) {
      const s = document.createElementNS(NS, 'stop'); s.setAttribute('offset', o); s.setAttribute('stop-color', col); grad.appendChild(s);
    }
    defs.appendChild(grad); svg.appendChild(defs);
    for (const w of wires) {
      const a = srcLi.get(w.src), b = dstLi.get(w.dst);
      if (!a || !b) continue;
      const [x1, y1] = c(a), [x2, y2] = c(b);
      gx1 = x1; gx2 = x2;
      const dx = (x2 - x1) * 0.55;
      const d = `M${x1.toFixed(1)} ${y1.toFixed(1)} C${(x1 + dx).toFixed(1)} ${y1.toFixed(1)} ${(x2 - dx).toFixed(1)} ${y2.toFixed(1)} ${x2.toFixed(1)} ${y2.toFixed(1)}`;
      const g = document.createElementNS(NS, 'g');
      g.setAttribute('class', 'w' + (w.event ? ' w-event' : '') + (deviceOf(w.src) && !devices[deviceOf(w.src)] ? ' w-off' : ''));
      for (const cls of ['w-base', 'w-flow']) { const p = document.createElementNS(NS, 'path'); p.setAttribute('class', cls); p.setAttribute('d', d); g.appendChild(p); }
      svg.appendChild(g);
      w.g = g; w.flow = g.lastChild;
    }
    grad.setAttribute('x1', gx1); grad.setAttribute('x2', gx2); grad.setAttribute('y1', 0); grad.setAttribute('y2', 0);
  }
  function setDevice(dev, on) {
    devices[dev] = on;
    for (const [sig, li] of srcLi) if (li.dataset.device === dev) on ? li.removeAttribute('data-off') : li.setAttribute('data-off', '');
    for (const w of wires) if (deviceOf(w.src) === dev) w.g?.classList.toggle('w-off', !on);
  }
  for (const li of srcLi.values()) if (li.dataset.device) li.setAttribute('data-off', '');
  bay.closest('.bay').classList.add('wired');
  layoutWires();
  // pulses light their wire on arrival
  signals.on('midi/note/on', () => { for (const w of wires) if (w.src === 'midi/note/on') w.act = Math.min(2, w.act + 0.9); });
  let lastNote = null;
  signals.on('midi/note/on', ({ note }) => { lastNote = note; });

  const vEl = (li) => li?.querySelector('.v');
  const fmt = (x) => (x == null || Number.isNaN(x)) ? '—' : (Math.abs(x) < 0.005 ? '0.00' : x.toFixed(2));
  function bayFrame(dt, state, paint) {
    for (const w of wires) {
      if (!w.event) {
        const v = signals.get(w.src);
        if (typeof v === 'number') { if (w.last !== null) w.act += Math.abs(v - w.last) * 14; w.last = v; }
      }
      w.act = Math.min(2, w.act * Math.exp(-dt * 2.6));
      if (!w.flow) continue;
      if (!reduced) { w.off -= dt * (6 + 70 * Math.min(1, w.act)); w.flow.style.strokeDashoffset = w.off.toFixed(1); }
      w.flow.style.opacity = (0.1 + Math.min(1, w.act) * 0.9).toFixed(2);
    }
    if (!paint) return;
    for (const [sig, li] of srcLi) {
      const el = vEl(li); if (!el) continue;
      if (li.hasAttribute('data-off')) { el.textContent = '—'; continue; }
      if (sig === 'midi/note/on') el.textContent = lastNote == null ? '—' : noteName(lastNote);
      else { const v = signals.get(sig); el.textContent = (sig === 'chord/consonance' && v > 0 ? '+' : '') + fmt(v); }
    }
    for (const [p, li] of dstLi) {
      const el = vEl(li); if (!el || p === '@world') continue;
      el.textContent = p === 'hue' ? Math.round(state[p]) + '°' : fmt(state[p]);
    }
  }

  // ---------- the score: a piano roll rising from the keys ----------
  const roll = document.getElementById('roll');
  const rctx = roll.getContext('2d');
  const notes = [];                     // { note, t0, t1, vel }
  let keyX = new Map();
  const measureKeys = () => {
    keyX = new Map();
    const kr = keysEl.getBoundingClientRect();
    for (const k of keysEl.querySelectorAll('.pk-key')) {
      const r = k.getBoundingClientRect();
      keyX.set(piano.base + Number(k.dataset.semi), [r.left - kr.left, r.width, k.classList.contains('pk-black')]);
    }
  };
  measureKeys();
  signals.on('midi/note/on', ({ note, vel }) => { notes.push({ note, t0: performance.now(), t1: 0, vel: vel ?? 0.8 }); if (notes.length > 160) notes.shift(); });
  signals.on('midi/note/off', ({ note }) => { for (let i = notes.length - 1; i >= 0; i--) if (notes[i].note === note && !notes[i].t1) { notes[i].t1 = performance.now(); break; } });
  function drawRoll(state) {
    const dpr = Math.min(2, devicePixelRatio || 1);
    const W = roll.clientWidth, H = roll.clientHeight;
    if (roll.width !== Math.round(W * dpr) || roll.height !== Math.round(H * dpr)) { roll.width = Math.round(W * dpr); roll.height = Math.round(H * dpr); }
    rctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    rctx.clearRect(0, 0, W, H);
    // staff: a faint line at every C
    rctx.fillStyle = 'rgba(237,235,229,0.06)';
    for (const [n, [x]] of keyX) if (n % 12 === 0) rctx.fillRect(Math.round(x), 0, 1, H);
    const now = performance.now(), speed = H / 1.6;      // px per second
    const hue = state.hue ?? 16;
    for (let i = notes.length - 1; i >= 0; i--) {
      const n = notes[i];
      const end = n.t1 || now;
      const yTop = H - ((now - n.t0) / 1000) * speed, yBot = H - ((now - end) / 1000) * speed;
      if (yBot < -2) { if (n.t1) notes.splice(i, 1); continue; }
      const k = keyX.get(n.note); if (!k) continue;
      const [x, w, black] = k;
      const a = n.t1 ? Math.max(0, 1 - (now - n.t1) / 1600) : 1;
      rctx.fillStyle = `hsla(${hue}, 92%, ${black ? 70 : 60}%, ${(0.35 + 0.65 * n.vel) * a})`;
      rctx.fillRect(x + w * 0.18, Math.max(0, yTop), w * 0.64, Math.max(2, yBot - Math.max(0, yTop)));
    }
  }

  // ---------- readouts ----------
  const hudChord = document.getElementById('hud-chord');
  const hudVoices = document.getElementById('hud-voices');
  const hudFps = document.getElementById('hud-fps');
  signals.on('chord/event', (a) => {
    if (!hudChord) return;
    const name = a.count === 1 ? noteName(a.root) : `${NAMES[chordRoot(a)]} ${a.chordType}`;
    const c = a.count > 1 ? ` · ${T.consonance} <b>${a.consonance > 0 ? '+' : ''}${a.consonance.toFixed(2)}</b>` : '';
    hudChord.innerHTML = name + c + ' · ';
  });
  const live = {
    sig: [...document.querySelectorAll('[data-live-sig]')],
    param: [...document.querySelectorAll('[data-live-param]')],
    fps: [...document.querySelectorAll('[data-live-fps]')],
  };

  // ---------- one loop drives everything (and sleeps when nobody can see it) ----------
  let frame = 0, liveAt = 0;
  const loop = new Loop((dt, now) => {
    sim.update(dt);
    audio?.update();
    mapper.update(dt);
    const state = stage.frame(dt, {});
    sound?.update(state);
    drawRoll(state);
    bayFrame(dt, state, (frame++ % 3) === 0);
    if (now - liveAt > 250) {
      liveAt = now;
      if (hudVoices) hudVoices.textContent = world.voices.length;
      if (hudFps) hudFps.textContent = loop.fps || 60;
      for (const el of live.sig) el.textContent = fmt(signals.get(el.dataset.liveSig));
      for (const el of live.param) el.textContent = Math.round(state[el.dataset.liveParam]);
      for (const el of live.fps) el.textContent = loop.fps || 60;
    }
  });
  let visible = true;
  const run = () => (visible && !document.hidden ? loop.start() : loop.stop());
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; run(); }, { rootMargin: '80px' }).observe(inst);
  document.addEventListener('visibilitychange', run);
  new ResizeObserver(() => { buildPiano(); measureKeys(); layoutWires(); }).observe(inst);

  // arrive alive: the simulated performer plays until someone takes over
  if (!reduced) setAuto(true); else status(T.statusIdle);
  run();
  window.openavHome = { signals, params, mapper, stage, world, sim, chord, loop };   // for curious devtools
}

// ---------- page utilities ----------
function wireCopyButtons() {
  for (const b of document.querySelectorAll('button.copy[data-copy]')) {
    b.addEventListener('click', async () => {
      const el = document.getElementById(b.dataset.copy); if (!el) return;
      const text = el.innerText.replace(/\n$/, '');
      try { await navigator.clipboard.writeText(text); }
      catch (e) {
        const r = document.createRange(); r.selectNodeContents(el);
        const s = getSelection(); s.removeAllRanges(); s.addRange(r);
        try { document.execCommand('copy'); } catch (e2) { /* selection stays for manual copy */ }
      }
      b.textContent = T.copied || 'Copied'; b.dataset.done = '';
      setTimeout(() => { b.textContent = T.copy || 'Copy'; delete b.dataset.done; }, 1600);
    });
  }
}

// switching language keeps your place: the same section id exists on both pages
function wireLanguageSwitch() {
  const current = () => {
    if (scrollY < 120) return '';
    let id = '';
    for (const s of document.querySelectorAll('main > section[id]')) if (s.getBoundingClientRect().top <= innerHeight * 0.35) id = s.id;
    return id;
  };
  for (const a of document.querySelectorAll('.langs a[data-lang]')) {
    a.addEventListener('click', () => {
      try { localStorage.setItem('oav.lang', a.dataset.lang); } catch (e) { /* private mode */ }
      const id = current();
      a.setAttribute('href', a.getAttribute('href').split('#')[0] + (id ? '#' + id : ''));
    });
  }
}
