// 11 · controller video — the work on top, the controller you are playing below. No camera.
//
//   • a small work (rings from notes, bursts from pads) renders into its own 1080×1080 canvas;
//   • @openav/midi's ControllerCanvas draws a controller profile — Arturia MiniLab 3 by default,
//     any profile in the library — into the bottom of @openav/record's Compositor every frame:
//     keys, pads, knobs, faders and strips as they move, the device's screen showing the last
//     touch, the held notes written large underneath. Vector at the output size: 4K stays sharp;
//   • it follows the generic MIDI names on the Signals bus, so everything moves it the same way:
//     a real controller (Connect MIDI), the on-screen piano / QWERTY keys, and a TakePlayer — the
//     "demo" below is a take, so a replayed clip animates the panel exactly as the hands did;
//   • ● Record writes the composite to one file (video only here; @openav/record's AudioTap adds
//     the work's sound, see 10-record).
//
// window.openav exposes everything for devtools / scripted checks.

import { Signals, Loop } from '@openav/core';
import { mountKeys } from '@openav/keys';
import { Midi, ControllerCanvas, PROFILES, profileById, matchProfile } from '@openav/midi';
import { Compositor, Recorder, TakePlayer, PRESETS, presetById, recommendedFps, signalsOfMidi, openCamera, takeStats } from '@openav/record';

const signals = new Signals();
const $ = (html) => { const t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstElementChild; };

// ───────────── the work: rings that bloom from notes, bursts from pads ─────────────
const work = (() => {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 1080;
  const ctx = canvas.getContext('2d');
  const rings = [];
  let t = 0, energy = 0;
  signals.on('midi/note/on', ({ note, vel = 0.8, ch }) => { rings.push({ note, vel, age: 0, pad: ch === 10 }); energy = Math.min(1.5, energy + vel * 0.35); });
  return {
    canvas,
    update(dt) {
      t += dt; energy *= Math.exp(-dt * 1.6);
      for (const r of rings) r.age += dt;
      while (rings.length && rings[0].age > 3.2) rings.shift();
    },
    render() {
      const W = canvas.width, c = W / 2;
      ctx.fillStyle = '#07080c'; ctx.fillRect(0, 0, W, W);
      ctx.save(); ctx.translate(c, c);
      ctx.strokeStyle = 'rgba(126,166,255,0.10)'; ctx.lineWidth = 2;
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2 + t * 0.05;
        ctx.beginPath(); ctx.moveTo(Math.cos(a) * 60, Math.sin(a) * 60); ctx.lineTo(Math.cos(a) * 520, Math.sin(a) * 520); ctx.stroke();
      }
      ctx.fillStyle = `rgba(126,166,255,${0.08 + energy * 0.25})`;
      ctx.beginPath(); ctx.arc(0, 0, 50 + energy * 90, 0, Math.PI * 2); ctx.fill();
      for (const r of rings) {
        const k = 1 - r.age / 3.2;
        if (r.pad) {                                   // a pad: a burst from the centre
          ctx.strokeStyle = `rgba(255,95,179,${k * k})`; ctx.lineWidth = 2 + r.vel * 6 * k;
          ctx.beginPath(); ctx.arc(0, 0, 60 + r.age * 420, 0, Math.PI * 2); ctx.stroke();
          continue;
        }
        const pc = r.note % 12, oct = Math.floor(r.note / 12);
        const a = (pc / 12) * Math.PI * 2 - Math.PI / 2 + t * 0.05, d = 110 + (oct - 3) * 75;
        ctx.strokeStyle = `hsla(${pc * 30}, 85%, 62%, ${k * k})`;
        ctx.lineWidth = 3 + r.vel * 9 * k;
        ctx.beginPath(); ctx.arc(Math.cos(a) * d, Math.sin(a) * d, 16 + r.age * 230 * (0.5 + r.vel), 0, Math.PI * 2); ctx.stroke();
      }
      ctx.restore();
    },
  };
})();

const keys = mountKeys(document.querySelector('#keys'), { signals, base: 48, octaves: 2 });
const loop = new Loop((dt) => { keys.update(dt); work.update(dt); work.render(); });
loop.start();

// ───────────── the controller, drawn ─────────────
const LOOKS = {
  device: { label: 'device colours', theme: {} },
  accent: { label: 'one accent', theme: { accent: '#7ea6ff' } },
  flat: { label: 'flat (no glow)', theme: { glow: 0 } },
};
let look = 'device';
let panel = new ControllerCanvas({ profile: 'arturia-minilab3', signals });
// measure what the panel costs per frame (the point of drawing it natively)
const cost = { n: 0, sum: 0, max: 0, avg: 0 };
const timed = (p) => ({
  get aspect() { return p.aspect; },
  draw(ctx, rect, now) {
    const t0 = performance.now(); p.draw(ctx, rect, now); const dt = performance.now() - t0;
    cost.n++; cost.sum += dt; cost.max = Math.max(cost.max, dt);
    if (cost.n >= 60) { cost.avg = cost.sum / cost.n; cost.peak = cost.max; cost.n = 0; cost.sum = 0; cost.max = 0; }
  },
});
function setProfile(id, theme = LOOKS[look].theme) {
  panel.dispose();
  panel = new ControllerCanvas({ profile: id, signals, theme });
  if (bottom === 'panel') comp.setPanel(timed(panel));
  ui.profileSel.value = panel.profile.id;
  paintFrame();
}

const comp = new Compositor({ size: 'vertical-1080p', layout: 'stack', getWorkCanvas: () => work.canvas });
let bottom = 'panel';
comp.setPanel(timed(panel));
document.querySelector('#preview').appendChild(comp.canvas);
comp.start();

// ───────────── a demo performance: a take, played into the bus like a recorded clip ─────────────
function demoTake() {
  const ev = [];
  const at = (t, e) => ev.push({ t, ...e });
  const chords = [[48, 55, 64, 67], [57, 60, 64, 69], [53, 57, 60, 65], [55, 59, 62, 67]];   // inside the MiniLab's 25 keys (48–72)
  chords.forEach((ch, i) => {
    const t0 = i * 2000;
    ch.forEach((n, j) => { at(t0 + j * 40, { type: 'noteon', ch: 1, note: n, vel: 70 + j * 12 }); at(t0 + 1700, { type: 'noteoff', ch: 1, note: n }); });
    [0, 500, 1000, 1500].forEach((d, k) => { const n = 36 + ((i * 4 + k) % 8); at(t0 + d + 250, { type: 'noteon', ch: 10, note: n, vel: 60 + k * 18 }); at(t0 + d + 400, { type: 'noteoff', ch: 10, note: n }); });
    [72, 71, 69, 67].forEach((n, k) => { at(t0 + 900 + k * 180, { type: 'noteon', ch: 1, note: n - (i % 2) * 2, vel: 90 }); at(t0 + 1040 + k * 180, { type: 'noteoff', ch: 1, note: n - (i % 2) * 2 }); });
  });
  const ccs = [74, 71, 76, 77, 93, 18, 19, 16, 82, 83, 85, 17];   // MiniLab 3 knobs 1–8, faders S1–S4
  for (let t = 0; t <= 8000; t += 50) {
    const k = ccs[Math.floor(t / 1000) % ccs.length], ph = (t % 1000) / 1000;
    at(t, { type: 'cc', ch: 1, cc: k, value: Math.round(64 + 60 * Math.sin(ph * Math.PI * 2)) });
    if (t % 100 === 0) at(t, { type: 'cc', ch: 1, cc: 1, value: Math.round(64 + 63 * Math.sin(t / 900)) });   // mod strip
    if (t >= 6000 && t <= 7600 && t % 100 === 0) at(t, { type: 'pitchbend', ch: 1, value: Math.round(8192 + 6000 * Math.sin((t - 6000) / 255)) });
  }
  at(7700, { type: 'pitchbend', ch: 1, value: 8192 });
  const events = [];
  for (const e of ev.sort((a, b) => a.t - b.t)) for (const s of signalsOfMidi(e)) events.push({ t: e.t, ...s });   // both families, like hardware
  return { v: 1, name: 'demo', durationMs: 8000, events, meta: { device: 'minilab3' } };
}
// clock 'timer': a 10 ms timer keeps the take going when the tab is in the background (requestAnimationFrame stops there;
// the compositor keeps drawing from a worker heartbeat, so a recording would otherwise show a frozen panel)
const player = new TakePlayer({ signals, take: demoTake(), loop: true, yieldToLive: true, resumeAfter: 6, clock: 'timer' });

// ───────────── the side panel ─────────────
document.querySelector('#panel').append(
  $('<div><h1>11 · controller video</h1><p class="sub">the work on top, the controller you play below — no camera</p></div>'),
  $(`<section><h2>Controller</h2>
      <label class="row"><span>device</span><select id="profile-sel"></select></label>
      <label class="row"><span>look</span><select id="look-sel"></select></label>
      <div class="row"><button id="midi-btn">🎹 Connect MIDI</button><button id="demo-btn">▶ Demo take</button></div>
      <p class="info" id="midi-info">play the piano below, QWERTY A–L, a real controller, or the demo take</p>
    </section>`),
  $(`<section><h2>Frame</h2>
      <label class="row"><span>size</span><select id="size-sel"></select></label>
      <label class="row"><span>layout</span><select id="layout-sel"><option value="stack">stack</option><option value="pip">pip</option><option value="side">side</option></select></label>
      <label class="row"><span>bottom</span><select id="bottom-sel"><option value="panel">controller panel</option><option value="camera">camera</option></select></label>
      <p class="note" id="cost-note"></p>
    </section>`),
  $(`<section><h2>Video</h2>
      <button class="big rec" id="rec-btn">● Record</button>
      <p class="info" id="rec-info"></p>
      <ul class="files" id="rec-files"></ul>
    </section>`),
);
const el = (id) => document.getElementById(id);
const ui = {
  profileSel: el('profile-sel'), lookSel: el('look-sel'), midiBtn: el('midi-btn'), demoBtn: el('demo-btn'), midiInfo: el('midi-info'),
  sizeSel: el('size-sel'), layoutSel: el('layout-sel'), bottomSel: el('bottom-sel'), costNote: el('cost-note'),
  recBtn: el('rec-btn'), recInfo: el('rec-info'), recFiles: el('rec-files'), label: el('frame-label'),
};
for (const p of PROFILES) ui.profileSel.appendChild(new Option(p.name, p.id));
for (const [id, l] of Object.entries(LOOKS)) ui.lookSel.appendChild(new Option(l.label, id));
for (const group of ['vertical', 'landscape', 'square']) {
  const og = document.createElement('optgroup'); og.label = group;
  for (const p of PRESETS.filter((x) => x.group === group)) og.appendChild(new Option(`${p.label} · ${p.fps} fps`, p.id));
  ui.sizeSel.appendChild(og);
}
ui.profileSel.value = panel.profile.id;
ui.sizeSel.value = 'vertical-1080p';

function paintFrame() {
  const { w, h } = comp.size;
  ui.label.textContent = `${w}×${h} · ${comp.layout} · ${bottom === 'panel' ? panel.profile.name : 'camera'} · ${recommendedFps(w, h)} fps`;
}
ui.profileSel.onchange = () => setProfile(ui.profileSel.value);
ui.lookSel.onchange = () => { look = ui.lookSel.value; setProfile(panel.profile.id); };
ui.sizeSel.onchange = () => {
  const p = presetById(ui.sizeSel.value);
  comp.setSize(p.id);
  const lay = p.layout === 'pip' ? 'stack' : p.layout;             // a square frame: stack splits it 60/40
  comp.setLayout(lay); ui.layoutSel.value = lay;
  paintFrame();
};
ui.layoutSel.onchange = () => { comp.setLayout(ui.layoutSel.value); paintFrame(); };
let camStream = null;
ui.bottomSel.onchange = async () => {
  bottom = ui.bottomSel.value;
  if (bottom === 'panel') { comp.setPanel(timed(panel)); paintFrame(); return; }
  comp.setPanel(null);
  if (!camStream) {
    try { camStream = await openCamera(); await comp.setCamera(camStream); }
    catch (e) { ui.midiInfo.textContent = 'camera: ' + e.message; ui.bottomSel.value = bottom = 'panel'; comp.setPanel(timed(panel)); }
  }
  paintFrame();
};

// hardware: the engine publishes the generic names; the panel follows them. A known device → its profile.
let midi = null;
ui.midiBtn.onclick = async () => {
  if (midi) return;
  midi = new Midi({ signals });
  const ok = await midi.enable();
  if (!ok) { ui.midiInfo.textContent = 'no Web MIDI here (Chrome / Edge / Firefox) — the piano, QWERTY and the demo still play'; midi = null; return; }
  const follow = (devs) => {
    ui.midiInfo.textContent = devs.length ? 'listening: ' + devs.map((d) => d.name).join(', ') : 'no MIDI device plugged in';
    const m = devs.map((d) => matchProfile(d.name, PROFILES)).find(Boolean);
    if (m && m.profile.id !== panel.profile.id) setProfile(m.profile.id);
  };
  midi.onDevices(follow); follow(midi.devices());
  ui.midiBtn.textContent = '🎹 MIDI on'; ui.midiBtn.classList.add('on');
};
ui.demoBtn.onclick = () => {
  if (player.playing) player.stop(); else player.play();
  paintDemo();
};
function paintDemo() {
  ui.demoBtn.classList.toggle('on', player.playing);
  ui.demoBtn.textContent = player.playing ? '■ Stop demo' : player.state === 'yielded' ? '▶ Demo (you took over)' : '▶ Demo take';
}
player.onState = paintDemo;

// ───────────── recording ─────────────
let session = null;
const fmt = (ms) => { const s = Math.floor(ms / 1000); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
const mb = (n) => (n / 1048576).toFixed(n > 10485760 ? 0 : 1) + ' MB';
ui.recBtn.onclick = async () => {
  if (!session) {
    const { w, h } = comp.size, fps = recommendedFps(w, h);
    const video = new Recorder({ canvas: comp.canvas, fps });
    video.start({ timeslice: 1000 });
    session = { video };
    ui.sizeSel.disabled = true;
    ui.recBtn.classList.add('on'); ui.recBtn.textContent = '■ Stop';
    return;
  }
  const s = session; session = null;
  ui.recBtn.disabled = true;
  const v = await s.video.stop();
  const url = URL.createObjectURL(v.blob), name = `controller-video-${Date.now()}.${v.ext}`;
  const li = document.createElement('li');
  li.append(Object.assign(document.createElement('a'), { href: url, download: name, textContent: name }), ' ',
    Object.assign(document.createElement('small'), { textContent: `${v.width}×${v.height} · ${v.fps} fps · ${fmt(v.durationMs)} · ${mb(v.bytes)}` }));
  ui.recFiles.prepend(li);
  ui.sizeSel.disabled = false; ui.recBtn.disabled = false;
  ui.recBtn.classList.remove('on'); ui.recBtn.textContent = '● Record';
};

(function meters() {
  if (cost.avg) ui.costNote.textContent = `panel: ${cost.avg.toFixed(2)} ms a frame (peak ${cost.peak.toFixed(2)}) · composite ${comp.fps} fps`;
  if (session) ui.recInfo.textContent = `● ${fmt(session.video.elapsed)} · ${mb(session.video.bytes)}`;
  requestAnimationFrame(meters);
})();
paintFrame();
paintDemo();

window.openav = {
  signals, keys, loop, comp, work, player, cost, demoTake, takeStats, profileById,
  get panel() { return panel; }, get midi() { return midi; }, setProfile,
};
