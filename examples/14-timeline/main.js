// 14 · timeline — automation you can see.
//
// The ring of light (the World) only reads params: hue, speed, density, zoom, shape. Who sets them
// is none of its business. Here the answer is the TIMELINE: one lane of keyframes per param,
// drawn under the stage, and the playhead is the only thing that moves them.
//
//   · lanes     a lane is `[[t, value, curve?], …]`; the timeline interpolates between keyframes with the curve
//               written on the keyframe (linear · ease · in · out · step), and a `step` param holds.
//   · scenes    the strip on top; the playhead crossing a boundary is the scene change (→ title, cuts)
//   · cues      ◆ one-shot events inside a scene: flash / ripple. The timeline fires them (onCue) when the
//               playhead PLAYS over them; scrubbing past does not, clicking a ◆ does (fireCue).
//   · scrub     press and drag anywhere on the lanes: the world follows the playhead, curves and all
//   · knobs     move a knob (here, or on the desk, or a mapped MIDI knob) and it OVERRIDES its lane:
//               the amber dot is where you took it, the hollow one is where the curve would be.
//               Latch (the timeline's own rule): you stay in charge until ↩. Touch: let go and it
//               falls back to the curve.
//   · record    ● arms timeline.record() on every lane; while the show plays, whatever a knob does is written
//               into that lane as new keyframes, over the old ones, and the curve takes over again.
//   · loop / hold   L loops the show (timeline.loop); ⏸ makes the current scene a HOLD: the playhead parks at its
//               end until Space or → (the same `hold` the score uses, here on a single scene)
//
// Space play · ← → scene · T performance mode · F fullscreen · R rewind · L loop.  No hardware needed.

import { createShow } from '@openav/show';
import { createCanvas } from '@openav/stage';
import { TOTAL, PARAMS, SCENES, LANES, compile } from './config.js?v=2399f6b';

const TAU = Math.PI * 2;
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const fmt = (t) => `${Math.floor(t / 60)}:${(Math.floor(t % 60) + '').padStart(2, '0')}.${Math.floor((t % 1) * 10)}`;

// ── the world: five rings that turn, breathe and change shape ────────────────────────────────────
// a ring point sits at angle φ on a circle or a regular polygon (radius from the polygon's own formula);
// when `shape` jumps (it is a step param) the rings morph to the new outline over ~0.4 s
const SIDES = [0, 3, 4, 6];
const outline = (sides, phi) => {
  if (!sides) return 1;
  const a = TAU / sides, x = ((phi % a) + a) % a - a / 2;
  return Math.cos(Math.PI / sides) / Math.cos(x);
};

const ring = {
  name: 'ring',
  params: PARAMS,
  init({ container, params }) {
    this.view = createCanvas(container);
    this.ang = [0, 0, 0, 0, 0];
    this.flash = 0; this.ripples = [];
    this.morph = { from: 0, to: 0, k: 1 };
    this.s = {};
    this._off = [params.onPulse('flash', () => { this.flash = 1; }), params.onPulse('ripple', () => this.ripples.push({ age: 0 }))];
  },
  update(dt, s) {
    this.s = s;
    const shape = Math.round(s.shape);
    if (shape !== this.morph.to) { this.morph = { from: this.radius, to: shape, k: 0 }; }
    this.morph.k = Math.min(1, this.morph.k + dt * 2.5);
    for (let r = 0; r < 5; r++) this.ang[r] += s.speed * dt * (0.25 + r * 0.14) * (r % 2 ? -1 : 1);
    this.flash = Math.max(0, this.flash - dt * 1.5);
    for (const rp of this.ripples) rp.age += dt;
    this.ripples = this.ripples.filter((rp) => rp.age < 1.6);
  },
  // the outline radius for angle φ, mid-morph
  radiusAt(phi) {
    const m = this.morph, e = m.k * m.k * (3 - 2 * m.k);
    const a = typeof m.from === 'function' ? m.from(phi) : outline(SIDES[m.from] ?? 0, phi);
    return a + (outline(SIDES[m.to], phi) - a) * e;
  },
  get radius() { const m = { ...this.morph }; return (phi) => { const e = m.k * m.k * (3 - 2 * m.k); const a = typeof m.from === 'function' ? m.from(phi) : outline(SIDES[m.from] ?? 0, phi); return a + (outline(SIDES[m.to], phi) - a) * e; }; },
  render() {
    const { ctx } = this.view, { w, h } = this.view.fit(), s = this.s;
    if (s.hue == null) return;
    const cx = w / 2, cy = h / 2, u = Math.min(w, h);
    ctx.fillStyle = 'rgba(5,6,12,0.24)'; ctx.fillRect(0, 0, w, h);
    const n = Math.max(6, Math.round(s.density / 5)), hue = s.hue % 360;
    for (let r = 0; r < 5; r++) {
      const R = u * 0.105 * (r + 1) * s.zoom, a0 = this.ang[r];
      const col = `hsl(${(hue + r * 18) % 360} 88% ${58 + r * 3 + this.flash * 25}%)`;
      const dot = (0.9 + s.zoom * 1.1 + r * 0.25) * (1 + this.flash * 0.9);
      ctx.strokeStyle = `hsla(${(hue + r * 18) % 360} 88% 62% / ${0.14 + this.flash * 0.3})`; ctx.lineWidth = 1;
      ctx.beginPath();
      const pts = [];
      for (let i = 0; i < n; i++) {
        const phi = (i / n) * TAU, rad = R * this.radiusAt(phi), a = phi + a0;
        pts.push(cx + Math.cos(a) * rad, cy + Math.sin(a) * rad);
      }
      for (let i = 0; i < pts.length; i += 2) i ? ctx.lineTo(pts[i], pts[i + 1]) : ctx.moveTo(pts[i], pts[i + 1]);
      ctx.closePath(); ctx.stroke();
      ctx.fillStyle = col;
      for (let i = 0; i < pts.length; i += 2) { ctx.beginPath(); ctx.arc(pts[i], pts[i + 1], dot, 0, TAU); ctx.fill(); }
    }
    for (const rp of this.ripples) {   // cue: ripple
      const k = rp.age / 1.6;
      ctx.strokeStyle = `hsla(${(hue + 40) % 360} 90% 75% / ${(1 - k) * 0.85})`; ctx.lineWidth = 2 + (1 - k) * 4;
      ctx.beginPath(); ctx.arc(cx, cy, u * 0.05 + k * u * 0.75, 0, TAU); ctx.stroke();
    }
    if (this.flash > 0.01) {           // cue: flash
      const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, u * 0.8);
      g.addColorStop(0, `hsla(${hue} 100% 88% / ${this.flash * 0.6})`); g.addColorStop(1, `hsla(${hue} 100% 60% / 0)`);
      ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    }
  },
  dispose() { this._off?.forEach((f) => f()); this.view.dispose(); },
};

// ── the show ────────────────────────────────────────────────────────────────────────────────────
const lanes = structuredClone(LANES);            // key + tag for the panel; the keyframes live in timeline.automation
const state = { touch: false, fired: 0 };
let ui = null;                                   // the panel, built below once the show exists

const show = await createShow({
  world: ring,
  timeline: { total: TOTAL, automation: compile(lanes), scenes: SCENES, loop: true },
  mount: { stage: '#stage', side: '#side' },
  modules: { keys: false },
  hint: 'Space play · ←/→ scene · L loop · T performance mode · F fullscreen · drag the lanes to scrub · move a knob to take over',
});
const { timeline: tl, params } = show;
const CUES = tl.cues();                          // for the ticks on the ruler

// cues fire when the playhead PLAYS over them (a scrub or a jump is not a performance): the timeline decides, we perform
function fireCue(c) {
  params.firePulse(c.name);
  state.fired++;
  ui?.toast.cue(c);
}
tl.onCue((c) => fireCue(c));
tl.onSceneChange((i, sc) => ui?.toast.scene(i, sc));

// ── recording: knob moves become keyframes ──────────────────────────────────────────────────────
// timeline.record(key, source) writes source() into the lane while the show plays; null means "nobody is touching".
// A take closes when the override is released (↩, touch-mode let-go), the show stops or jumps, or the loop wraps:
// the timeline thins it, stitches it over the lane's keyframes for the time it covered, and the curve takes over again.
const armRecording = () => { for (const p of PARAMS) if (!p.pulse) tl.record(p.key, () => (params.isOverridden(p.key) ? params.overrides[p.key] : null)); };
tl.onRecord((e) => { params.clearOverride(e.key); ui?.laneChanged(e.key); });

// ── the timeline panel ──────────────────────────────────────────────────────────────────────────
const COLORS = { hue: '#ff8ad8', speed: '#6fd3ff', density: '#9be37a', zoom: '#ffc86b', shape: '#b9a2ff' };
const KIND_COLORS = { linear: '#8fa3c7', ease: '#4fd1c5', in: '#ff9f5a', out: '#c28bff', step: '#ffd166' };
const SCENE_H = 22, RULER_H = 18, LANE_H = 50, TOP = SCENE_H + RULER_H, PAD_L = 8, PAD_R = 10;

ui = buildPanel(document.getElementById('tl'));
requestAnimationFrame(function tick() { ui.render(); requestAnimationFrame(tick); });
tl.play();                                       // open the page, touch nothing: it plays itself

function buildPanel(root) {
  const style = document.createElement('style');
  style.textContent = `
  #tl { flex: none; background: #0b0e15; border-top: 1px solid #1c2334; color: #cfd6e4; font: 11px ui-monospace, SFMono-Regular, Menlo, monospace; position: relative; user-select: none; -webkit-user-select: none; }
  #tl.rec { box-shadow: inset 0 0 0 1px #ff4d5e; }
  #tl .bar { display: flex; gap: 6px; align-items: center; flex-wrap: wrap; padding: 6px 8px; }
  #tl .bar .t { font-size: 13px; color: #fff; min-width: 96px; }
  #tl .bar .sc { color: #7ea6ff; min-width: 90px; }
  #tl button { background: #1a2030; color: #cfd6e4; border: 1px solid #2a3348; border-radius: 6px; padding: 3px 8px; font: inherit; cursor: pointer; }
  #tl button:hover { background: #232c42; }
  #tl button.on { background: #2e6df6; border-color: #2e6df6; color: #fff; }
  #tl button.recb.on { background: #ff4d5e; border-color: #ff4d5e; animation: tlpulse 1s infinite; }
  #tl button.holdb.on { background: #ffd166; border-color: #ffd166; color: #111; }
  #tl .sp { flex: 1; }
  #tl .lg { color: #7d879c; display: flex; gap: 8px; flex-wrap: wrap; }
  #tl .lg i { font-style: normal; } #tl .lg b { font-weight: 400; }
  #tl .body { display: grid; grid-template-columns: 112px minmax(0, 1fr); }
  #tl .heads { padding-top: ${TOP}px; }
  #tl .lh { height: ${LANE_H}px; box-sizing: border-box; padding: 4px 6px 0 8px; border-bottom: 1px solid #141a29; }
  #tl .lh .l1 { display: flex; align-items: center; gap: 4px; height: 15px; }
  #tl .lh b { font-weight: 600; flex: 1; }
  #tl .lh .val { color: #8892a8; }
  #tl .lh.man .val { color: #ffb02e; }
  #tl .lh button { padding: 0 5px; font-size: 10px; line-height: 14px; border-color: #ffb02e; color: #ffb02e; }
  #tl .lh button[hidden] { display: none; }
  #tl .lh input { width: 100%; margin: 3px 0 0; height: 12px; accent-color: #ffb02e; }
  #tl canvas { display: block; width: 100%; touch-action: none; cursor: col-resize; }
  #tl .help { padding: 4px 8px 6px; color: #5d6780; min-height: 2.8em; line-height: 1.4; }   /* two lines always, so the lanes never jump when the text changes */
  .tl-toast { position: absolute; left: 18px; top: 16px; pointer-events: none; text-shadow: 0 2px 18px #000; }
  .tl-toast .big { font: 700 clamp(26px, 5vw, 46px) system-ui, sans-serif; letter-spacing: .01em; color: #fff; opacity: .92; }
  .tl-toast .big small { font: 600 13px ui-monospace, monospace; color: #7ea6ff; margin-right: 10px; letter-spacing: .08em; }
  .tl-toast .note { font: 13px system-ui, sans-serif; color: #aab3c7; margin-top: 2px; }
  .tl-toast .cue { margin-top: 8px; font: 600 12px ui-monospace, monospace; color: #ffd166; opacity: 0; transition: opacity 1.2s; }
  .tl-toast .cue.now { opacity: 1; transition: none; }
  .tl-toast.sw .big { animation: tlin .7s ease-out; }
  @keyframes tlin { from { opacity: 0; transform: translateY(8px); } to { opacity: .92; transform: none; } }
  @keyframes tlpulse { 50% { opacity: .55; } }
  @media (max-width: 760px) { #tl .body { grid-template-columns: 92px minmax(0, 1fr); } #tl .lh .val { display: none; } #tl .lg { display: none; } }
  `;
  document.head.appendChild(style);

  root.innerHTML = `
    <div class="bar">
      <button data-a="play" title="play / pause (Space)">▶</button>
      <span class="t">0:00.0</span><span class="sc"></span>
      <button data-a="loop" title="loop the show (L)">↻ loop</button>
      <button data-a="hold" class="holdb" title="make the current scene a HOLD: the playhead parks at its end until Space / →">⏸ hold scene</button>
      <button data-a="rec" class="recb" title="record knob moves into the lanes">● rec</button>
      <button data-a="mode" title="Latch: a knob stays in charge until ↩. Touch: let go and the curve takes over.">knob: latch</button>
      <button data-a="free" title="give every knob back to its curve">↩ all</button>
      <span class="sp"></span>
      <span class="lg"><i style="color:${KIND_COLORS.linear}">● linear</i><i style="color:${KIND_COLORS.ease}">● ease</i><i style="color:${KIND_COLORS.in}">● in</i><i style="color:${KIND_COLORS.out}">● out</i><i style="color:${KIND_COLORS.step}">■ step</i><i style="color:#ffd166">◆ cue</i></span>
    </div>
    <div class="body"><div class="heads"></div><canvas></canvas></div>
    <div class="help"></div>`;
  const $ = (s) => root.querySelector(s);
  const heads = $('.heads'), cv = $('canvas'), ctx = cv.getContext('2d'), help = $('.help');
  const timeEl = $('.t'), scEl = $('.sc');
  const btn = (a) => root.querySelector(`[data-a=${a}]`);
  const put = (el, text) => { if (el.textContent !== text) el.textContent = text; };   // 60 DOM writes a second would also swallow clicks

  // lane heads: a label, the live value, ↩ when the knob has taken over, and the knob itself
  const rows = {};
  for (const lane of lanes) {
    const p = params.get(lane.key), row = document.createElement('div');
    row.className = 'lh'; row.title = `${p.label}: ${lane.tag}`;
    row.innerHTML = `<div class="l1"><b style="color:${COLORS[lane.key]}">${p.label}</b><span class="val"></span><button hidden title="back to the curve">↩</button></div><input type="range" min="${p.min}" max="${p.max}" step="${p.step || (p.max - p.min) / 400}">`;
    const input = row.querySelector('input');
    input.addEventListener('input', () => params.override(lane.key, Number(input.value)));
    input.addEventListener('change', () => { if (state.touch) releaseKnob(lane.key); input.blur(); });   // Space must keep meaning "play"
    row.querySelector('button').addEventListener('click', () => releaseKnob(lane.key));
    heads.appendChild(row);
    rows[lane.key] = { row, input, val: row.querySelector('.val'), back: row.querySelector('button') };
  }
  function releaseKnob(key) { if (tl.recorders.get(key)?.take.length) tl.recorders.get(key).commit('release'); else params.clearOverride(key); }

  // buttons
  root.querySelector('.bar').addEventListener('click', (e) => {
    const a = e.target.closest('button')?.dataset.a;
    if (a === 'play') tl.toggle();
    else if (a === 'loop') tl.loop = !tl.loop;
    else if (a === 'hold') { const sc = tl.currentScene(); if (tl.sceneIndexAt() < SCENES.length - 1) sc.hold = !sc.hold; }
    else if (a === 'rec') { if (tl.recording) tl.stopRecording(); else { armRecording(); if (!tl.playing) tl.play(); } }
    else if (a === 'mode') state.touch = !state.touch;
    else if (a === 'free') { for (const r of tl.recorders.values()) r.commit('manual'); params.clearAllOverrides(); }
    e.target.closest('button')?.blur();
  });
  addEventListener('keydown', (e) => {
    if (e.metaKey || e.ctrlKey || e.altKey || e.repeat || /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) return;
    if (e.key === 'l' || e.key === 'L') tl.loop = !tl.loop;
  });

  // the stage overlay: scene title + the cue that just fired
  const toastEl = document.createElement('div');
  toastEl.className = 'tl-toast';
  toastEl.innerHTML = '<div class="big"></div><div class="note"></div><div class="cue"></div>';
  document.getElementById('stage').appendChild(toastEl);
  let cueTimer = 0;
  const toast = {
    scene(i, sc) {
      toastEl.querySelector('.big').innerHTML = `<small>SCENE ${i + 1}/${SCENES.length}</small>${sc.title}`;
      toastEl.querySelector('.note').textContent = sc.note || '';
      toastEl.classList.remove('sw'); void toastEl.offsetWidth; toastEl.classList.add('sw');
    },
    cue(c) {
      const el = toastEl.querySelector('.cue'); el.textContent = `◆ cue · ${c.name} · ${fmt(c.t)}`;
      el.classList.add('now'); clearTimeout(cueTimer); cueTimer = setTimeout(() => el.classList.remove('now'), 250);
    },
  };
  toast.scene(tl.sceneIndexAt(), tl.currentScene());

  // geometry + cached curves
  let W = 0, H = 0, dpr = 1, paths = {};
  const xOf = (t) => PAD_L + (t / TOTAL) * (W - PAD_L - PAD_R);
  const tOf = (x) => clamp((x - PAD_L) / (W - PAD_L - PAD_R), 0, 1) * TOTAL;
  const yOf = (li, v) => { const p = params.get(lanes[li].key); return TOP + li * LANE_H + LANE_H - 6 - ((v - p.min) / (p.max - p.min)) * (LANE_H - 12); };
  function buildPath(li) {
    const key = lanes[li].key, path = new Path2D(), n = Math.max(2, Math.round(W - PAD_L - PAD_R));
    for (let i = 0; i <= n; i++) { const t = (i / n) * TOTAL, y = yOf(li, tl.valueAt(key, t)), x = xOf(t); i ? path.lineTo(x, y) : path.moveTo(x, y); }
    return path;
  }
  function resize() {
    dpr = Math.min(2, devicePixelRatio || 1);
    W = cv.clientWidth; H = TOP + lanes.length * LANE_H;
    cv.style.height = H + 'px'; cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    paths = {};
  }
  new ResizeObserver(resize).observe(cv); resize();

  // press / drag to scrub: the world follows. A press on a ◆ jumps onto it and fires it.
  let drag = null;
  cv.addEventListener('pointerdown', (e) => {
    const r = cv.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top;
    cv.setPointerCapture(e.pointerId);
    if (y > SCENE_H && y < TOP) {
      const c = CUES.find((q) => Math.abs(xOf(q.t) - x) < 8);
      if (c) { tl.seek(c.t, 'jump'); tl.fireCue(c); return; }
    }
    drag = { wasPlaying: tl.playing }; tl.pause();
    tl.seek(tOf(x));
  });
  cv.addEventListener('pointermove', (e) => { if (drag) tl.seek(tOf(e.clientX - cv.getBoundingClientRect().left)); });
  const end = () => { if (drag?.wasPlaying) tl.play(); drag = null; };
  cv.addEventListener('pointerup', end); cv.addEventListener('pointercancel', end);

  function render() {
    const t = tl.t, cur = tl.sceneIndexAt(), over = params.overrides;
    // header text + knobs
    put(timeEl, `${fmt(t)} / ${fmt(TOTAL)}`);
    put(scEl, `#${cur + 1} ${SCENES[cur].title}${tl.holding ? ' · HOLD' : ''}`);
    put(btn('play'), tl.holding ? 'HOLD' : tl.playing ? '⏸' : '▶');
    btn('play').classList.toggle('on', tl.playing);
    btn('loop').classList.toggle('on', !!tl.loop);
    btn('hold').classList.toggle('on', !!SCENES[cur].hold);
    btn('hold').disabled = cur === SCENES.length - 1;
    const rec = tl.recording;
    btn('rec').classList.toggle('on', rec);
    put(btn('mode'), state.touch ? 'knob: touch' : 'knob: latch');
    root.classList.toggle('rec', rec);
    const base = tl.state();
    for (const lane of lanes) {
      const r = rows[lane.key], man = lane.key in over, v = man ? over[lane.key] : base[lane.key];
      r.row.classList.toggle('man', man); r.back.hidden = !man;
      put(r.val, (Math.abs(v) >= 100 ? v.toFixed(0) : v.toFixed(2)) + (man ? ' ✋' : ''));
      if (document.activeElement !== r.input) r.input.value = v;
    }
    put(help, rec
      ? '● REC: let the show play and move a knob. What it does is written into that lane, over the old curve. ↩ (or stop) closes the take.'
      : tl.holding ? 'HOLD: parked at the end of the scene. Space or → lets the show go on.'
      : 'Press and drag the lanes to scrub. Move a knob and it takes over its lane (amber); ↩ gives it back. ● rec writes knob moves into the curve. ⏸ hold scene parks the show at the end of the scene you are in.');

    // canvas
    if (!W) return;
    ctx.clearRect(0, 0, W, H);
    ctx.font = '10px ui-monospace, Menlo, monospace'; ctx.textBaseline = 'middle';
    // scene strip
    for (let i = 0; i < SCENES.length; i++) {
      const s = SCENES[i], x0 = xOf(s.t), x1 = xOf(tl.sceneEnd(i));
      ctx.fillStyle = i === cur ? 'rgba(46,109,246,.30)' : i % 2 ? 'rgba(255,255,255,.035)' : 'rgba(255,255,255,.07)';
      ctx.fillRect(x0, 0, x1 - x0, SCENE_H);
      ctx.fillStyle = i === cur ? '#fff' : '#8892a8'; ctx.textAlign = 'left';
      ctx.save(); ctx.beginPath(); ctx.rect(x0, 0, x1 - x0 - 2, SCENE_H); ctx.clip();
      ctx.fillText(`${i + 1} ${s.title}${s.hold ? ' ⏸' : ''}`, x0 + 6, SCENE_H / 2 + 1); ctx.restore();
      if (i === cur) { ctx.fillStyle = 'rgba(46,109,246,.08)'; ctx.fillRect(x0, SCENE_H, x1 - x0, H - SCENE_H); }
      ctx.strokeStyle = '#2a3348'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(Math.round(x0) + .5, 0); ctx.lineTo(Math.round(x0) + .5, H); ctx.stroke();
      if (s.hold && i < SCENES.length - 1) { ctx.strokeStyle = '#ffd166'; ctx.setLineDash([4, 3]); ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x1 - 1, 0); ctx.lineTo(x1 - 1, H); ctx.stroke(); ctx.setLineDash([]); }
    }
    // ruler + cues
    ctx.fillStyle = '#5d6780';
    for (let s = 0; s <= TOTAL; s += 5) { const x = xOf(s); ctx.fillRect(x, TOP - 5, 1, 5); ctx.textAlign = s === 0 ? 'left' : s === TOTAL ? 'right' : 'center'; if (W > 420 || s % 10 === 0) ctx.fillText(`0:${String(s).padStart(2, '0')}`, s === 0 ? x - 4 : s === TOTAL ? x + 4 : x, SCENE_H + 7); }
    for (const c of CUES) {
      const x = xOf(c.t), y = SCENE_H + RULER_H / 2 + 3, passed = c.t <= t;
      ctx.fillStyle = passed ? '#ffd166' : '#6b5a2d'; ctx.beginPath(); ctx.moveTo(x, y - 6); ctx.lineTo(x + 5, y); ctx.lineTo(x, y + 6); ctx.lineTo(x - 5, y); ctx.fill();
      if (tl.playing && t >= c.t && t - c.t < 0.35) { ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5; ctx.stroke(); }
    }
    // lanes
    for (let li = 0; li < lanes.length; li++) {
      const lane = lanes[li], key = lane.key, y0 = TOP + li * LANE_H, man = key in over, col = COLORS[key];
      ctx.strokeStyle = '#141a29'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(0, y0 + LANE_H - .5); ctx.lineTo(W, y0 + LANE_H - .5); ctx.stroke();
      if (man) { ctx.fillStyle = 'rgba(255,176,46,.07)'; ctx.fillRect(0, y0, W, LANE_H); }
      ctx.fillStyle = '#4a5472'; ctx.textAlign = 'left'; ctx.fillText(lane.tag, PAD_L + 4, y0 + 8);
      ctx.save(); ctx.beginPath(); ctx.rect(0, y0, W, LANE_H); ctx.clip();
      // the part already played is brighter than what is still to come
      const p = (paths[key] ||= buildPath(li)), px = xOf(t);
      ctx.lineWidth = 1.6; ctx.strokeStyle = col; ctx.globalAlpha = man ? 0.35 : 0.9; ctx.stroke(p);
      ctx.globalAlpha = 1;
      // the take being recorded
      const take = tl.recorders.get(key)?.take;
      if (take?.length > 1) { ctx.strokeStyle = '#ff4d5e'; ctx.lineWidth = 2.4; ctx.beginPath(); take.forEach(([tt, v], k) => (k ? ctx.lineTo(xOf(tt), yOf(li, v)) : ctx.moveTo(xOf(tt), yOf(li, v)))); ctx.stroke(); }
      // keyframe anchors, coloured by the curve that ARRIVES at them
      const anchors = tl.automation[key];
      for (const [tt, v, kind = 'linear'] of anchors) {
        const x = xOf(tt), y = yOf(li, v); ctx.fillStyle = KIND_COLORS[kind] || '#8fa3c7';
        if (kind === 'step') ctx.fillRect(x - 3, y - 3, 6, 6); else { ctx.beginPath(); ctx.arc(x, y, anchors.length > 12 ? 2 : 3, 0, TAU); ctx.fill(); }
      }
      // the playhead's value: hollow on the curve, amber where a knob holds it
      const cy = yOf(li, base[key]);
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(px, cy, 4.5, 0, TAU); ctx.stroke();
      if (man) { const my = yOf(li, over[key]); ctx.strokeStyle = 'rgba(255,176,46,.6)'; ctx.setLineDash([3, 3]); ctx.beginPath(); ctx.moveTo(px, cy); ctx.lineTo(px, my); ctx.stroke(); ctx.setLineDash([]); ctx.fillStyle = '#ffb02e'; ctx.beginPath(); ctx.arc(px, my, 5, 0, TAU); ctx.fill(); }
      ctx.restore();
    }
    // playhead
    const px = Math.round(xOf(t)) + .5;
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(px, 0); ctx.lineTo(px, H); ctx.stroke();
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.moveTo(px - 5, 0); ctx.lineTo(px + 5, 0); ctx.lineTo(px, 7); ctx.fill();
  }

  return { render, toast, laneChanged(key) { delete paths[key]; } };
}
