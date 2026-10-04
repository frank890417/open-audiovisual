// 10 · record — a performance video: the work on top, your hands below, one file, in sync.
//
//   • the work (a small World of rings, played from the on-screen piano, QWERTY keys or the
//     simulated performer) renders into its own 1080×1080 canvas, as any work does;
//   • @openav/record's Compositor puts it and the webcam into ONE canvas of an exact size —
//     vertical 1080×1920 (stack: work square on top, camera below), 4:5, 2.7K, 4K, landscape,
//     square; layouts stack · pip · side · work;
//   • one Recorder records that canvas together with the work's own sound (an AudioTap on the
//     synth; tick "mic" to add the room): picture and sound share one clock, nothing to line up;
//   • a second, audio-only Recorder keeps the work's sound as its own file, and an EventLog keeps
//     every note with its time — the take's score, to re-render or re-sync later;
//   • MIDI takes: ● record what you play, ▶ play it back into the show (the world and the synth
//     cannot tell it from you), save it as .json or .mid, load a .mid back. With "yield to live",
//     playing a key yourself silences the take.
//
// window.openav exposes everything for devtools / scripted checks.

import { Signals, Loop } from '@openav/core';
import { mountKeys } from '@openav/keys';
import {
  Compositor, Recorder, AudioTap, EventLog, TakeRecorder, TakePlayer, PRESETS, LAYOUTS, presetById,
  recommendedFps, layoutRects, listCameras, openCamera, toMidiFile, fromMidiFile, normalizeTake, validateTake, trimSilence, takeStats,
} from '@openav/record';

const signals = new Signals();
const $ = (html) => { const t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstElementChild; };

// ───────────── the work: rings that bloom from the notes ─────────────
// (a stand-in for any work: the recorder only ever sees its canvas)
const work = (() => {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 1080;
  const ctx = canvas.getContext('2d');
  const rings = [];
  let t = 0, energy = 0;
  signals.on('midi/note/on', ({ note, vel = 0.8 }) => { rings.push({ note, vel, age: 0 }); energy = Math.min(1.5, energy + vel * 0.35); });
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
      for (let i = 0; i < 12; i++) {             // twelve spokes, one per pitch class
        const a = (i / 12) * Math.PI * 2 + t * 0.05;
        ctx.beginPath(); ctx.moveTo(Math.cos(a) * 60, Math.sin(a) * 60); ctx.lineTo(Math.cos(a) * 520, Math.sin(a) * 520); ctx.stroke();
      }
      ctx.fillStyle = `rgba(126,166,255,${0.08 + energy * 0.25})`;
      ctx.beginPath(); ctx.arc(0, 0, 50 + energy * 90, 0, Math.PI * 2); ctx.fill();
      for (const r of rings) {
        const pc = r.note % 12, oct = Math.floor(r.note / 12);
        const a = (pc / 12) * Math.PI * 2 - Math.PI / 2 + t * 0.05, d = 110 + (oct - 3) * 75;
        const k = 1 - r.age / 3.2;
        ctx.strokeStyle = `hsla(${pc * 30}, 85%, 62%, ${k * k})`;
        ctx.lineWidth = 3 + r.vel * 9 * k;
        ctx.beginPath(); ctx.arc(Math.cos(a) * d, Math.sin(a) * d, 16 + r.age * 230 * (0.5 + r.vel), 0, Math.PI * 2); ctx.stroke();
      }
      ctx.restore();
    },
  };
})();

// ───────────── the work's sound: a small WebAudio voice, tapped for the recording ─────────────
let actx = null, tap = null, out = null;
const voices = new Map();
async function ensureAudio() {
  if (!actx) {
    actx = new AudioContext();
    const bus = actx.createGain(); bus.gain.value = 0.6;
    out = actx.createDynamicsCompressor();
    bus.connect(out); out.connect(actx.destination);
    out.input = bus;
    tap = new AudioTap({ context: actx, sources: [out] });   // what the speakers get is what the file gets
  }
  if (actx.state === 'suspended') await actx.resume();
  return tap;
}
signals.on('midi/note/on', ({ note, vel = 0.8 }) => {
  if (!actx || actx.state !== 'running') return;
  const t = actx.currentTime, f = 440 * 2 ** ((note - 69) / 12);
  const g = actx.createGain();
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(0.22 * vel + 0.02, t + 0.006);
  g.gain.exponentialRampToValueAtTime(0.06 * vel + 0.005, t + 0.7);
  const o1 = actx.createOscillator(), o2 = actx.createOscillator(), g2 = actx.createGain();
  o1.type = 'triangle'; o1.frequency.value = f;
  o2.type = 'sine'; o2.frequency.value = f * 2; g2.gain.value = 0.25;
  o1.connect(g); o2.connect(g2); g2.connect(g); g.connect(out.input);
  o1.start(t); o2.start(t);
  voices.get(note)?.();
  voices.set(note, () => { const s = actx.currentTime; g.gain.cancelScheduledValues(s); g.gain.setTargetAtTime(0, s, 0.12); o1.stop(s + 0.8); o2.stop(s + 0.8); });
});
signals.on('midi/note/off', ({ note }) => { voices.get(note)?.(); voices.delete(note); });
for (const ev of ['pointerdown', 'keydown']) addEventListener(ev, () => { ensureAudio().catch(() => {}); }, { once: true });

// ───────────── the loop, the piano ─────────────
const keys = mountKeys(document.querySelector('#keys'), { signals, base: 48, octaves: 2 });
const loop = new Loop((dt) => { keys.update(dt); work.update(dt); work.render(); });
loop.start();

// ───────────── the compositor ─────────────
let hands = null;
const comp = new Compositor({
  size: 'vertical-1080p', layout: 'stack',
  getWorkCanvas: () => work.canvas,
  onDraw: (ctx, rects, c) => {
    // a hand skeleton over the camera (optional, loads MediaPipe): @openav/pose draws, the compositor places it
    if (hands && hands.running && ui.handsBox.checked) c.drawOnCamera((g, w, h) => hands.skeleton(g, w, h, { lineWidth: Math.max(2, w / 300) }));
  },
});
document.querySelector('#preview').appendChild(comp.canvas);
comp.start();

// ───────────── the panel ─────────────
const panel = document.querySelector('#panel');
panel.append(
  $('<div><h1>10 · record</h1><p class="sub">the work + your hands → one video, with the work\'s own sound</p></div>'),
  $(`<section><h2>Camera</h2>
      <div class="row"><button id="cam-btn">📷 Start camera</button><label class="row"><input type="checkbox" id="mirror" checked> mirror</label></div>
      <label class="row"><span>device</span><select id="cam-sel" disabled><option>—</option></select></label>
      <label class="row"><input type="checkbox" id="hands"> hand skeleton overlay <small class="note">(MediaPipe, CDN)</small></label>
    </section>`),
  $(`<section><h2>Frame</h2>
      <label class="row"><span>size</span><select id="size-sel"></select></label>
      <label class="row"><span>layout</span><select id="layout-sel"></select></label>
      <label class="row"><span>corner</span><select id="corner-sel"><option value="br">bottom right</option><option value="bl">bottom left</option><option value="tr">top right</option><option value="tl">top left</option></select></label>
      <p class="note" id="fps-note"></p>
    </section>`),
  $(`<section><h2>Sound</h2>
      <div class="row"><button id="snd-btn">🔊 Enable sound</button><label class="row"><input type="checkbox" id="mic"> + mic in the video</label></div>
      <div class="row"><span class="note" style="margin:0;width:64px">level</span><div class="meter"><i id="meter"></i></div></div>
    </section>`),
  $(`<section><h2>Video</h2>
      <button class="big rec" id="rec-btn">● Record</button>
      <p class="info" id="rec-info"></p>
      <ul class="files" id="rec-files"></ul>
    </section>`),
  $(`<section><h2>MIDI take</h2>
      <div class="row"><button class="rec" id="take-rec">● Rec take</button><button id="take-play" disabled>▶ Play</button></div>
      <div class="row"><label class="row"><input type="checkbox" id="take-loop" checked> loop</label><label class="row"><input type="checkbox" id="take-yield" checked> yield to live</label><label class="row"><input type="checkbox" id="take-trim" checked> trim silence</label></div>
      <p class="info" id="take-info">play something: ● Rec take, play, ● again to stop</p>
      <div class="row"><label class="row" style="margin:0"><span style="width:auto">load</span><input type="file" id="take-file" accept=".json,.mid,.midi,application/json,audio/midi"></label></div>
      <ul class="files" id="take-files"></ul>
    </section>`),
);
const el = (id) => document.getElementById(id);
const ui = {
  camBtn: el('cam-btn'), camSel: el('cam-sel'), mirror: el('mirror'), handsBox: el('hands'),
  sizeSel: el('size-sel'), layoutSel: el('layout-sel'), cornerSel: el('corner-sel'), fpsNote: el('fps-note'),
  sndBtn: el('snd-btn'), mic: el('mic'), meter: el('meter'),
  recBtn: el('rec-btn'), recInfo: el('rec-info'), recFiles: el('rec-files'),
  takeRec: el('take-rec'), takePlay: el('take-play'), takeLoop: el('take-loop'), takeYield: el('take-yield'), takeTrim: el('take-trim'),
  takeInfo: el('take-info'), takeFile: el('take-file'), takeFiles: el('take-files'),
  label: el('frame-label'),
};

for (const group of ['vertical', 'landscape', 'square']) {
  const og = document.createElement('optgroup'); og.label = group;
  for (const p of PRESETS.filter((x) => x.group === group)) og.appendChild(new Option(`${p.label} · ${p.fps} fps`, p.id));
  ui.sizeSel.appendChild(og);
}
for (const l of LAYOUTS) ui.layoutSel.appendChild(new Option(l, l));
ui.sizeSel.value = 'vertical-1080p';
ui.layoutSel.value = 'stack';

function paintFrame() {
  const { w, h } = comp.size, fps = recommendedFps(w, h), cam = comp.cameraSize;
  ui.label.textContent = `${w}×${h} · ${comp.layout} · ${fps} fps`;
  // most webcams top out at 1080p: say so when this frame enlarges the camera
  const r = cam && layoutRects(comp.layout, comp.size, { workW: work.canvas.width, workH: work.canvas.height, camW: cam.w, camH: cam.h }, comp.layoutOptions).cam;
  const up = r && r.crop ? r.w / r.crop.w : 0;
  ui.fpsNote.textContent = `records at ${fps} fps` + (up > 1.05 ? ` · the camera (${cam.w}×${cam.h}) is enlarged ${up.toFixed(1)}× here; the work is drawn at full size` : '');
}
ui.sizeSel.onchange = () => {
  const p = presetById(ui.sizeSel.value);
  comp.setSize(p.id);
  comp.setLayout(p.layout); ui.layoutSel.value = p.layout;   // each shape has its natural layout; pick another after
  paintFrame();
};
ui.layoutSel.onchange = () => { comp.setLayout(ui.layoutSel.value); paintFrame(); };
ui.cornerSel.onchange = () => { comp.setLayout(comp.layout, { pip: { corner: ui.cornerSel.value } }); paintFrame(); };
ui.mirror.onchange = () => { comp.mirrorCam = ui.mirror.checked; if (hands) hands.mirror = ui.mirror.checked; };

// camera
let camStream = null;
async function startCamera(deviceId) {
  if (camStream) camStream.getTracks().forEach((t) => t.stop());
  ui.camBtn.disabled = true;
  try {
    camStream = await openCamera({ deviceId });
    const size = await comp.setCamera(camStream);
    const cams = await listCameras();
    ui.camSel.replaceChildren(...cams.map((c) => new Option(c.label, c.deviceId)));
    ui.camSel.disabled = false;
    const live = camStream.getVideoTracks()[0]?.getSettings?.().deviceId;
    if (live) ui.camSel.value = live;
    ui.camBtn.textContent = size ? `📷 ${size.w}×${size.h}` : '📷 camera on';
  } catch (e) {
    ui.camBtn.textContent = '📷 camera failed — retry';
    console.warn('[10-record] camera:', e.message);
  }
  ui.camBtn.disabled = false;
  paintFrame();
}
ui.camBtn.onclick = () => startCamera(ui.camSel.disabled ? '' : ui.camSel.value);
ui.camSel.onchange = () => startCamera(ui.camSel.value);
ui.handsBox.onchange = async () => {
  if (!ui.handsBox.checked || hands) return;
  try {
    const { HandTracker } = await import('@openav/pose');
    hands = new HandTracker({ signals, mirror: comp.mirrorCam });
    await hands.enable();          // its own small camera stream; landmarks are normalized, so they map onto ours
  } catch (e) { console.warn('[10-record] hands:', e.message); ui.handsBox.checked = false; hands = null; }
};

// sound
ui.sndBtn.onclick = async () => { await ensureAudio(); ui.sndBtn.textContent = '🔊 sound on'; ui.sndBtn.disabled = true; };
ui.mic.onchange = async () => {
  const t = await ensureAudio();
  if (ui.mic.checked) { try { await t.addMicrophone(); } catch (e) { ui.mic.checked = false; console.warn('[10-record] mic:', e.message); } }
  else t.removeMicrophone();
};

// ───────────── recording: video (+ sound), sound alone, event log ─────────────
const urls = [];
let session = null;
const fmt = (ms) => { const s = Math.floor(ms / 1000); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
const mb = (n) => (n / 1048576).toFixed(n > 10485760 ? 0 : 1) + ' MB';
const stamp = () => { const d = new Date(), p = (n) => String(n).padStart(2, '0'); return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`; };
function fileLink(list, blob, name, note) {
  const url = URL.createObjectURL(blob); urls.push(url);
  const li = document.createElement('li');
  const a = Object.assign(document.createElement('a'), { href: url, download: name, textContent: name });
  li.append(a, ' ', Object.assign(document.createElement('small'), { textContent: note }));
  list.appendChild(li);
  return a;
}

async function startRecording() {
  const t = await ensureAudio();
  const { w, h } = comp.size, fps = recommendedFps(w, h);
  const video = new Recorder({ canvas: comp.canvas, fps, audioTracks: t.tracks });
  const audio = new Recorder({ audioOnly: true, audioTracks: t.workTracks });
  const log = new EventLog({ throttleMs: 33, filter: (n) => /^(midi|hand|take)\//.test(n) });
  video.start({ timeslice: 1000 });
  audio.start({ timeslice: 1000 });
  log.start(video.t0); log.attach(signals);
  session = { video, audio, log, name: `oav-${stamp()}` };
  ui.sizeSel.disabled = true;          // the encoder's size is fixed for the take
  ui.recBtn.classList.add('on'); ui.recBtn.textContent = '■ Stop';
}
async function stopRecording() {
  const s = session; session = null;
  ui.recBtn.disabled = true;
  const [v, a] = await Promise.all([s.video.stop(), s.audio.stop()]);
  s.log.stop(); s.log.detach();
  const events = s.log.toJSON();
  urls.splice(0).forEach((u) => URL.revokeObjectURL(u));
  ui.recFiles.replaceChildren();
  fileLink(ui.recFiles, v.blob, `${s.name}.${v.ext}`, `${v.width}×${v.height} · ${v.fps} fps · ${fmt(v.durationMs)} · ${mb(v.bytes)}${v.audio ? '' : ' · no sound'}`);
  fileLink(ui.recFiles, a.blob, `${s.name}-sound.${a.ext}`, `the work's sound alone · ${mb(a.bytes)}`);
  fileLink(ui.recFiles, new Blob([JSON.stringify(events, null, 1)], { type: 'application/json' }), `${s.name}-events.json`, `${events.count} events`);
  ui.recInfo.textContent = `${v.mimeType}` + (v.error ? ` · error: ${v.error.message || v.error}` : '');
  window.openav.last = { video: v, audio: a, events };
  ui.sizeSel.disabled = false;
  ui.recBtn.disabled = false;
  ui.recBtn.classList.remove('on'); ui.recBtn.textContent = '● Record';
}
ui.recBtn.onclick = () => (session ? stopRecording() : startRecording()).catch((e) => { ui.recInfo.textContent = 'recording failed: ' + e.message; console.warn(e); });

// ───────────── MIDI takes ─────────────
const takeRec = new TakeRecorder({ signals, name: 'take' });
const player = new TakePlayer({ signals, loop: true, yieldToLive: true, onState: () => paintTake() });
let take = null, takeUrls = [];
function paintTake() {
  ui.takeRec.classList.toggle('on', takeRec.running);
  ui.takeRec.textContent = takeRec.running ? '■ Stop take' : '● Rec take';
  ui.takePlay.disabled = !take || takeRec.running;
  ui.takePlay.textContent = player.playing ? '■ Stop' : player.state === 'yielded' ? '▶ Play (you took over)' : '▶ Play';
  if (take && !takeRec.running) {
    const s = takeStats(take);
    ui.takeInfo.textContent = `${take.name} · ${s.notes} notes · ${fmt(s.durationMs)}` + (player.playing ? ` · ${Math.round(player.progress * 100)}%` : '');
  }
}
function useTake(t) {
  take = t;
  player.load(take);
  takeUrls.forEach((u) => URL.revokeObjectURL(u)); takeUrls = [];
  ui.takeFiles.replaceChildren();
  const json = fileLink(ui.takeFiles, new Blob([JSON.stringify(take)], { type: 'application/json' }), `${take.name}.json`, 'take (JSON)');
  const mid = fileLink(ui.takeFiles, new Blob([toMidiFile(take)], { type: 'audio/midi' }), `${take.name}.mid`, 'Standard MIDI File');
  takeUrls.push(json.href, mid.href);
  paintTake();
}
ui.takeRec.onclick = () => {
  if (takeRec.running) {
    let t = takeRec.stop();
    if (ui.takeTrim.checked) t = trimSilence(t, { keep: 250 });
    t.name = `take-${stamp()}`;
    if (!t.events.length) { ui.takeInfo.textContent = 'nothing was played'; paintTake(); return; }
    useTake(t);
  } else {
    player.stop();
    takeRec.start();
    ui.takeInfo.textContent = '● recording what you play…';
  }
  paintTake();
};
ui.takePlay.onclick = () => { if (player.playing) player.stop(); else { ensureAudio(); player.play(); } paintTake(); };
ui.takeLoop.onchange = () => { player.loop = ui.takeLoop.checked; };
ui.takeYield.onchange = () => { player.yieldToLive = ui.takeYield.checked; };
ui.takeFile.onchange = async () => {
  const f = ui.takeFile.files[0]; if (!f) return;
  try {
    const t = /\.midi?$/i.test(f.name) ? fromMidiFile(await f.arrayBuffer(), { name: f.name.replace(/\.midi?$/i, '') }) : normalizeTake(await f.text());
    const problems = validateTake(t);
    if (problems.length) throw new Error(problems[0]);
    useTake(t);
  } catch (e) { ui.takeInfo.textContent = 'could not read ' + f.name + ': ' + e.message; }
};

// ───────────── meters ─────────────
(function meters() {
  ui.meter.style.width = (tap ? Math.round(Math.min(1, tap.level() * 1.4) * 100) : 0) + '%';
  if (session) ui.recInfo.innerHTML = `<span class="dot"></span><span class="timer">${fmt(session.video.elapsed)}</span> · ${mb(session.video.bytes)} · ${comp.fps} fps composite`;
  if (player.playing) paintTake();
  requestAnimationFrame(meters);
})();
paintFrame();
paintTake();

window.openav = {
  signals, keys, loop, comp, work, player, takeRec,
  get tap() { return tap; }, get audioContext() { return actx; }, get session() { return session; }, get take() { return take; },
  ensureAudio, startCamera, startRecording, stopRecording, useTake,
};
