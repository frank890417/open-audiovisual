// @openav/midi · canvas — a controller drawn into a 2D canvas (for video), and the pure parts
// under it: generic signal → MIDI event (eventOfSignal), each message once from a bus that
// publishes it twice (followMidiSignals), faceplate / keyboard geometry, octave windows, the
// device-screen text, fades — and the drawing itself against a recording fake 2D context.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { eventOfSignal, genericSignals, publish, encodeMessage } from '../packages/midi/parse.js';
import {
  ControllerCanvas, CANVAS_THEME, controllerGeometry, keyboardGeometry, keyWindow, followMidiSignals, touchText, midiNoteName, fadeLevel, mixColor, withAlpha,
} from '../packages/midi/canvas.js';
import { MidiController } from '../packages/midi/controller.js';
import { PROFILES, profileById } from '../packages/midi/profiles/index.js';
import { normalizeProfile } from '../packages/midi/profiles.js';
import { CONTROL_COLORS } from '../packages/midi/view.js';
import { Signals } from '../packages/core/index.js';
import { TakePlayer } from '../packages/record/take-player.js';
import { signalsOfMidi } from '../packages/record/take.js';

const MINILAB = normalizeProfile(profileById('arturia-minilab3'));
const BOX = { x: 0, y: 1080, w: 1080, h: 840 };              // the camera's area of a 1080×1920 stack
const hw = (signals, ev) => publish(signals, genericSignals(ev, { device: 'minilab3-midi' }));   // what the Midi engine does per message
const tick = () => new Promise((r) => setTimeout(r, 0));

// A 2D context that records what was filled / stroked, in which colour, starting where.
function fakeCtx() {
  const log = [];
  let at = null;
  const grad = () => { const g = { stops: [], addColorStop(o, c) { g.stops.push(c); } }; return g; };
  const colorsOf = (s) => (s && typeof s === 'object' ? s.stops : [s]);
  const target = {
    log, fillStyle: '#000', strokeStyle: '#000', lineWidth: 1, globalAlpha: 1, shadowBlur: 0, shadowColor: 'transparent', font: '', letterSpacing: '0px',
    createLinearGradient: grad, createRadialGradient: grad, createConicGradient: grad,
    moveTo(x, y) { at = { x, y }; }, roundRect(x, y) { at = { x, y }; }, rect(x, y) { at = { x, y }; },
    fill() { log.push({ op: 'fill', colors: colorsOf(target.fillStyle), at, alpha: target.globalAlpha }); },
    fillRect(x, y, w, h) { log.push({ op: 'fill', colors: colorsOf(target.fillStyle), at: { x, y }, alpha: target.globalAlpha }); },
    stroke() { log.push({ op: 'stroke', colors: colorsOf(target.strokeStyle), at, alpha: target.globalAlpha }); },
    fillText(s, x, y) { log.push({ op: 'text', text: s, colors: colorsOf(target.fillStyle), at: { x, y } }); },
  };
  return new Proxy(target, { get: (t, k) => (k in t ? t[k] : () => {}), set: (t, k, v) => { t[k] = v; return true; } });
}
const fills = (ctx, color) => ctx.log.filter((e) => e.op === 'fill' && e.colors.includes(color));
const texts = (ctx) => ctx.log.filter((e) => e.op === 'text').map((e) => e.text);

// ───────────── eventOfSignal: the inverse of genericSignals ─────────────

test('eventOfSignal inverts genericSignals exactly, both families, every message type', () => {
  const evs = [
    { type: 'noteon', ch: 1, note: 60, vel: 100 }, { type: 'noteon', ch: 10, note: 36, vel: 1 }, { type: 'noteon', ch: 16, note: 127, vel: 127 },
    { type: 'noteoff', ch: 1, note: 60, vel: 0 }, { type: 'cc', ch: 1, cc: 74, value: 0 }, { type: 'cc', ch: 1, cc: 74, value: 127 },
    { type: 'cc', ch: 1, cc: 1, value: 63 }, { type: 'pitchbend', ch: 1, value: 8192 }, { type: 'pitchbend', ch: 1, value: 0 }, { type: 'pitchbend', ch: 1, value: 16383 },
  ];
  for (const ev of evs) {
    for (const s of genericSignals(ev)) {
      const r = eventOfSignal(s.name, s.value);
      assert.ok(r, s.name);
      const { device, ...back } = r.ev; void device;
      assert.deepEqual(back, ev, `${s.name} = ${JSON.stringify(s.value)}`);
      assert.equal(r.family, s.name.startsWith('midi/ch/') ? 'channel' : 'legacy');
    }
  }
  for (const ev of [{ type: 'chanat', ch: 3, value: 90 }, { type: 'polyat', ch: 10, note: 37, value: 12 }]) {
    const [s] = genericSignals(ev);
    assert.deepEqual(eventOfSignal(s.name, s.value).ev, ev);
  }
});

test('eventOfSignal: legacy names without a channel, the on-screen piano, and what it ignores', () => {
  assert.deepEqual(eventOfSignal('midi/note/on', { note: 60, vel: 0.5, ch: 0 }).ev, { type: 'noteon', ch: 1, note: 60, vel: 64 }, 'the piano says ch 0');
  assert.deepEqual(eventOfSignal('midi/note/on', { note: 60, vel: 0.5, velocity: 99, ch: 2 }).ev.vel, 99, 'velocity wins over vel');
  assert.deepEqual(eventOfSignal('midi/note/on', { note: 62 }).ev, { type: 'noteon', ch: 1, note: 62, vel: 100 });
  assert.equal(eventOfSignal('midi/note/on', { note: 62, vel: 0 }).ev.type, 'noteoff');
  assert.deepEqual(eventOfSignal('midi/cc/74', 0.5, { channel: 4 }).ev, { type: 'cc', ch: 4, cc: 74, value: 64 });
  assert.deepEqual(eventOfSignal('midi/bend', 0, { channel: 2 }).ev, { type: 'pitchbend', ch: 2, value: 8192 });
  for (const [n, v] of [['midi/minilab3/knob1', 0.5], ['midi/minilab3/keys/on', { note: 60 }], ['midi/virtual', { data: [0x90, 60, 100] }],
    ['midi/ch/17/cc/1', 0.5], ['midi/ch/1/cc/200', 0.5], ['midi/ch/1/note/60', { x: 1 }], ['midi/note/on', 5], ['audio/rms', 0.4], [null, 1]]) {
    assert.equal(eventOfSignal(n, v), null, String(n));
  }
});

// ───────────── followMidiSignals: each message once ─────────────

test('followMidiSignals: hardware publishes every message twice — it arrives once, in order', async () => {
  const s = new Signals(), got = [];
  const f = followMidiSignals(s, (ev) => got.push(ev));
  const msgs = [{ type: 'noteon', ch: 1, note: 60, vel: 100 }, { type: 'cc', ch: 1, cc: 28, value: 65 }, { type: 'cc', ch: 1, cc: 28, value: 65 },
    { type: 'pitchbend', ch: 1, value: 9000 }, { type: 'noteoff', ch: 1, note: 60, vel: 0 }];
  for (const m of msgs) hw(s, m);
  await tick();
  assert.deepEqual(got.map((e) => [e.type, e.note ?? e.cc ?? e.value]), [['noteon', 60], ['cc', 28], ['cc', 28], ['pitchbend', 9000], ['noteoff', 60]],
    'a relative encoder step counts once, not twice');
  f.dispose();
});

test('followMidiSignals: legacy-only sources (the QWERTY piano) come through after a microtask', async () => {
  const s = new Signals(), got = [];
  followMidiSignals(s, (ev) => got.push(ev));
  s.pulse('midi/note/on', { note: 64, vel: 0.8, ch: 0 });
  assert.equal(got.length, 0, 'waits for a possible per-channel twin');
  await tick();
  assert.deepEqual(got, [{ type: 'noteon', ch: 1, note: 64, vel: 102 }]);
});

test('followMidiSignals: a legacy CC never lands on the wrong channel; mixed sources keep their order', () => {
  const s = new Signals(), got = [], queue = [];
  const f = followMidiSignals(s, (ev) => got.push(ev), { defer: (fn) => queue.push(fn) });
  hw(s, { type: 'cc', ch: 2, cc: 74, value: 100 });              // legacy midi/cc/74 would say ch 1
  assert.deepEqual(got, [{ type: 'cc', ch: 2, cc: 74, value: 100 }]);
  got.length = 0;
  s.pulse('midi/note/on', { note: 50, vel: 1, ch: 0 });           // piano (legacy only)…
  hw(s, { type: 'noteon', ch: 1, note: 60, vel: 90 });            // …then hardware in the same tick
  assert.deepEqual(got.map((e) => e.note), [50, 60], 'the piano note is not overtaken');
  queue.splice(0).forEach((fn) => fn());
  assert.equal(got.length, 2, 'nothing doubled at the flush');
  f.flush(); f.dispose();
  s.pulse('midi/note/on', { note: 70, ch: 1 }); f.flush();
  assert.equal(got.length, 2, 'disposed: deaf');
});

// ───────────── pure geometry ─────────────

test('keyboardGeometry: 48–72 (MiniLab 3) = 15 whites tiling the rect, 10 blacks over the seams', () => {
  const r = { x: 10, y: 20, w: 900, h: 150 };
  const keys = keyboardGeometry(48, 72, r);
  const whites = keys.filter((k) => k.white), blacks = keys.filter((k) => !k.white);
  assert.equal(whites.length, 15); assert.equal(blacks.length, 10);
  assert.equal(keys.indexOf(blacks[0]), 15, 'whites first, blacks drawn over them');
  assert.ok(Math.abs(whites[0].x - 10) < 1e-9 && Math.abs(whites[14].x + whites[14].w - 910) < 1e-9);
  for (const b of blacks) {
    assert.ok(Math.abs(b.h - 90) < 1e-9);
    const left = whites.find((w) => w.note === b.note - 1);
    assert.ok(Math.abs(b.x + b.w / 2 - (left.x + left.w)) < 1e-9, `black ${b.note} sits on the seam`);
  }
  assert.equal(keyboardGeometry(49, 60, r).find((k) => k.note === 49), undefined, 'a range never starts on a black key');
});

test('keyWindow: the drawing follows the device\'s octave buttons by as few octaves as reach the note', () => {
  assert.equal(keyWindow(48, 72, 48, 60), 48, 'inside: unchanged');
  assert.equal(keyWindow(48, 72, 48, 76), 60, 'Oct+ → 60–84');
  assert.equal(keyWindow(48, 72, 48, 100), 84, 'Oct+ ×3');
  assert.equal(keyWindow(48, 72, 48, 40), 36, 'Oct− → 36–60');
  assert.equal(keyWindow(48, 72, 60, 70), 60, 'stays shifted while notes fit');
  assert.equal(keyWindow(48, 72, 48, 127), 103, 'clamped to MIDI');
  assert.equal(keyWindow(48, 72, 48, 0), 0);
  assert.equal(keyWindow(60, 64, 60, 70), 66, 'a range narrower than an octave still reaches the note');
});

test('controllerGeometry: every shipped profile fits its area — face inside, controls inside their sections, no overlaps', () => {
  for (const raw of PROFILES) {
    const p = normalizeProfile(raw);
    for (const rect of [BOX, { x: 0, y: 0, w: 2160, h: 1680 }, { x: 1080, y: 0, w: 840, h: 1080 }, { x: 5, y: 7, w: 300, h: 900 }]) {
      const g = controllerGeometry(p, rect);
      const inside = (a, b, eps = 1e-6) => a.x >= b.x - eps && a.y >= b.y - eps && a.x + a.w <= b.x + b.w + eps && a.y + a.h <= b.y + b.h + eps;
      assert.ok(inside(g.face, rect), `${p.id} face in ${JSON.stringify(rect)}`);
      assert.ok(Math.abs(g.face.w / g.face.h - p.face.w / p.face.h) < 1e-9, `${p.id} keeps its aspect`);
      if (g.notes) assert.ok(inside(g.notes, rect) && g.notes.y >= g.face.y + g.face.h, `${p.id} notes under the face`);
      assert.equal(g.controls.size, p.controls.length, `${p.id}: every control placed`);
      for (const sec of g.sections) {
        const cells = [...g.controls.values()].filter((c) => c.section === sec.id);
        for (const c of cells) assert.ok(inside(c, sec), `${p.id} ${c.id} inside ${sec.id}`);
        for (let i = 0; i < cells.length; i++) for (let j = i + 1; j < cells.length; j++) {
          const a = cells[i], b = cells[j];
          assert.ok(a.x + a.w <= b.x + 1e-6 || b.x + b.w <= a.x + 1e-6 || a.y + a.h <= b.y + 1e-6 || b.y + b.h <= a.y + 1e-6, `${p.id}: ${a.id} overlaps ${b.id}`);
        }
      }
    }
  }
});

test('controllerGeometry: the MiniLab 3 under a square work (1080×840) — big, centred, a notes strip below', () => {
  const g = controllerGeometry(MINILAB, BOX);
  assert.ok(g.face.w > 0.9 * 1080, 'nearly the full width');
  assert.ok(Math.abs(g.face.x + g.face.w / 2 - 540) < 1e-6);
  assert.ok(g.notes, 'room for the held notes');
  const k = g.controls.get('keys');
  assert.ok(k.w > g.face.w * 0.9 && k.y > g.controls.get('pad1').y, 'keys along the bottom, below the pads');
  // a tight box: no strip, the device is never shrunk for it
  const tight = controllerGeometry(MINILAB, { x: 0, y: 0, w: 1000, h: 640 });
  assert.equal(tight.notes, null);
  assert.equal(controllerGeometry(MINILAB, { x: 0, y: 0, w: 1000, h: 640 }, { notes: false }).u, tight.u);
  assert.ok(controllerGeometry(MINILAB, { x: 0, y: 0, w: 1000, h: 640 }, { notes: true }).notes, 'notes: true makes room');
  // nanoKONTROL2: faders span the 3 rows of their column (column flow)
  const nk = controllerGeometry(normalizeProfile(profileById('korg-nanokontrol2')), BOX);
  const f1 = nk.controls.get('f1'), s1 = nk.controls.get('s1');
  assert.ok(f1 && s1 && Math.abs(f1.h - nk.sections.find((s) => s.id === 'strips').grid.h) < 1e-6, 'a fader spans the whole strip height');
});

test('touchText, note names, fades', () => {
  const c = (id) => MINILAB.controls.find((x) => x.id === id);
  assert.equal(touchText(c('knob1'), { raw: 87 }), 'Knob 1 · 87');
  assert.equal(touchText(c('s2'), { raw: 64 }), 'S2 · 64');
  assert.equal(touchText(c('pad3'), { held: true, raw: 96 }), 'Pad 3 · 96');
  assert.equal(touchText(c('keys'), { raw: 100 }, 60), 'C4 · 100');
  assert.equal(touchText(c('pitch'), { value: 0.42 }), 'Pitch +0.42');
  assert.equal(touchText(c('pitch'), { value: -0.5 }), 'Pitch −0.50');
  assert.equal(touchText(c('enc'), { pos: 0.5 }), 'Main · 50%');
  assert.deepEqual([midiNoteName(60), midiNoteName(48), midiNoteName(61), midiNoteName(0)], ['C4', 'C3', 'C#4', 'C-1']);
  assert.equal(fadeLevel(100, 100, 400), 1);
  assert.equal(fadeLevel(600, 100, 400), 0);
  assert.ok(Math.abs(fadeLevel(300, 100, 400) - 0.25) < 1e-9, 'eased (quadratic)');
  assert.equal(fadeLevel(100, null, 400), 0);
  assert.equal(mixColor('#000000', '#ffffff', 0.5), '#808080');
  assert.equal(withAlpha('#ff5fb3', 0.5), 'rgba(255,95,179,0.5)');
  assert.equal(withAlpha('red', 0.5), 'red');
});

// ───────────── the canvas: state from the bus, drawn ─────────────

test('ControllerCanvas follows the hardware on the bus: keys, pads, knobs — nothing published back', () => {
  let t = 1000;
  const s = new Signals();
  const panel = new ControllerCanvas({ signals: s, now: () => t });
  const before = s.list().length;
  hw(s, { type: 'noteon', ch: 1, note: 60, vel: 100 });
  hw(s, { type: 'noteon', ch: 10, note: 38, vel: 127 });       // pad 3
  hw(s, { type: 'cc', ch: 1, cc: 74, value: 100 });            // knob 1
  hw(s, { type: 'pitchbend', ch: 1, value: 16383 });
  const c = panel.controller;
  assert.ok(c.keys.has(60));
  assert.ok(c.get('pad3').held);
  assert.equal(c.get('knob1').raw, 100);
  assert.equal(c.get('pitch').value, 1);
  assert.equal(panel.last.text, 'Pitch +1.00');
  assert.equal(s.list().filter((x) => /^midi\/minilab3\//.test(x.name)).length, 0, 'a silent model: no midi/minilab3/… echoed');
  assert.ok(s.list().slice(before).every((x) => /^midi\/(note\/(on|off)|cc\/\d+|bend|ch\/\d+\/)/.test(x.name)), 'only what the hardware itself published');
  hw(s, { type: 'noteoff', ch: 1, note: 60 });
  assert.ok(!c.keys.has(60));
  panel.dispose();
  hw(s, { type: 'noteon', ch: 1, note: 62, vel: 100 });
  assert.ok(!c.keys.has(62), 'disposed: deaf');
});

test('ControllerCanvas: the device\'s octave shift moves the drawn keyboard', () => {
  const s = new Signals(), panel = new ControllerCanvas({ signals: s });
  assert.equal(panel.keyBase, 48);
  hw(s, { type: 'noteon', ch: 1, note: 79, vel: 90 });         // Oct+ on the MiniLab, G5
  assert.equal(panel.keyBase, 60);
  assert.ok(panel.controller.keys.has(79), 'the keys catch any note on their channel');
});

test('a take playing back moves the panel exactly like the hands did (and lets go at stop)', async () => {
  const s = new Signals(), panel = new ControllerCanvas({ signals: s });
  const events = [];
  const add = (t, ev) => { for (const x of signalsOfMidi(ev)) events.push({ t, ...x }); };
  add(0, { type: 'noteon', ch: 1, note: 64, vel: 80 });
  add(100, { type: 'noteon', ch: 10, note: 36, vel: 120 });
  add(200, { type: 'cc', ch: 1, cc: 82, value: 127 });
  add(900, { type: 'noteoff', ch: 1, note: 64 });
  const player = new TakePlayer({ signals: s, take: { v: 1, name: 't', durationMs: 1000, events }, clock: 'manual', loop: false });
  player.play();
  player.update(0.25);
  await tick();
  const c = panel.controller;
  assert.ok(c.keys.has(64), 'key held during playback');
  assert.ok(c.get('pad1').held, 'pad hit during playback');
  assert.equal(c.get('s1').raw, 127, 'fader S1 moved');
  player.stop();
  await tick();
  assert.equal(c.keys.size, 0, 'stop releases the key on the panel too');
  // a legacy-only take (QWERTY piano) works as well
  const legacy = new TakePlayer({ signals: s, take: { v: 1, name: 'q', durationMs: 500, events: [{ t: 0, name: 'midi/note/on', value: { note: 55, vel: 0.7, ch: 0 } }] }, clock: 'manual' });
  legacy.play(); legacy.update(0.1); await tick();
  assert.ok(c.keys.has(55));
  legacy.stop(); await tick();
  assert.ok(!c.keys.has(55));
  player.dispose(); legacy.dispose(); panel.dispose();
});

test('ControllerCanvas can follow an existing controller instead (learned mapping included)', () => {
  const live = new MidiController(profileById('arturia-minilab3'));
  live.bindMessage('knob1', { type: 'cc', ch: 1, cc: 20 });
  const panel = new ControllerCanvas({ controller: live });
  live.ingest([0xb0, 20, 90], { source: 'hw' });
  assert.equal(panel.controller.get('knob1').raw, 90);
  assert.equal(panel.last.text, 'Knob 1 · 90');
  panel.dispose();
  live.ingest([0xb0, 20, 10], { source: 'hw' });
  assert.equal(live.get('knob1').raw, 10, 'the live controller is untouched by dispose');
  // a mapping handed to a signal-following panel
  const s = new Signals(), p2 = new ControllerCanvas({ signals: s, mapping: live.exportMapping() });
  hw(s, { type: 'cc', ch: 1, cc: 20, value: 33 });
  assert.equal(p2.controller.get('knob1').raw, 33);
  assert.throws(() => new ControllerCanvas({ profile: 'no-such-device' }), /unknown profile/);
});

test('draw: idle is calm; a held key, a hit pad and a turned knob light in their colours, then fade', () => {
  let t = 0;
  const s = new Signals(), panel = new ControllerCanvas({ signals: s, now: () => t });
  const KEY = CONTROL_COLORS.cyan, PAD = CONTROL_COLORS.magenta;
  let ctx = fakeCtx(); panel.draw(ctx, BOX, t);
  assert.equal(fills(ctx, KEY).length, 0, 'idle: no lit key');
  assert.equal(fills(ctx, PAD).length, 0, 'idle: no lit pad');
  assert.ok(ctx.log.length > 100 && ctx.log.length < 2000, `a few hundred calls (${ctx.log.length})`);
  assert.ok(fills(ctx, CANVAS_THEME.bg).length >= 1, 'the area gets the background');

  hw(s, { type: 'noteon', ch: 1, note: 60, vel: 127 });
  hw(s, { type: 'noteon', ch: 10, note: 36, vel: 100 });
  hw(s, { type: 'cc', ch: 1, cc: 74, value: 127 });
  ctx = fakeCtx(); panel.draw(ctx, BOX, t);
  const key60 = keyboardGeometry(48, 72, panel.geometry(BOX).controls.get('keys')).find((k) => k.note === 60);
  const litKeys = fills(ctx, KEY);
  assert.equal(litKeys.length, 1, 'one key lit');
  assert.ok(Math.abs(litKeys[0].at.x - key60.x) < 1e-6, 'and it is C4');
  assert.ok(fills(ctx, PAD).length >= 1, 'pad 1 lit');
  assert.ok(ctx.log.some((e) => e.op === 'stroke' && e.colors.includes(KEY)), 'knob 1 arc in its colour');
  assert.ok(texts(ctx).includes('C4'), 'held notes written under the faceplate');
  assert.ok(texts(ctx).includes('Knob 1 · 127'), 'the device screen shows the last touch');

  hw(s, { type: 'noteoff', ch: 1, note: 60 });
  hw(s, { type: 'noteoff', ch: 10, note: 36 });
  t = 60; ctx = fakeCtx(); panel.draw(ctx, BOX, t);
  const fading = fills(ctx, KEY);
  assert.equal(fading.length, 1, 'a released key fades (a short note stays visible on video)');
  assert.ok(fading[0].alpha < 1);
  assert.ok(fills(ctx, PAD).length >= 1, 'the pad fades too');
  t = 2000; ctx = fakeCtx(); panel.draw(ctx, BOX, t);
  assert.equal(fills(ctx, KEY).length, 0, 'gone after the fade');
  assert.equal(fills(ctx, PAD).length, 0);
});

test('draw: theme — one accent for everything, no background, any profile at any size', () => {
  const s = new Signals(), panel = new ControllerCanvas({ signals: s, theme: { accent: '#7ea6ff', bg: null } });
  hw(s, { type: 'noteon', ch: 10, note: 36, vel: 100 });
  const ctx = fakeCtx(); panel.draw(ctx, BOX);
  assert.equal(fills(ctx, CONTROL_COLORS.magenta).length, 0);
  assert.ok(fills(ctx, '#7ea6ff').length >= 1);
  assert.equal(fills(ctx, CANVAS_THEME.bg).length, 0, 'bg: null leaves what is underneath');
  for (const raw of PROFILES) {
    const p = new ControllerCanvas({ profile: raw, signals: s });
    for (const r of [BOX, { x: 0, y: 0, w: 2160, h: 1680 }, { x: 0, y: 0, w: 3, h: 2 }]) assert.doesNotThrow(() => p.draw(fakeCtx(), r, 0), raw.id);
    assert.ok(p.aspect > 0);
    p.dispose();
  }
  // renderTo: its own canvas
  const canvas = { width: 1200, height: 744, getContext: () => fakeCtx() };
  assert.equal(panel.renderTo(canvas), canvas);
});
