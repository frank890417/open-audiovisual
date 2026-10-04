// @openav/record — the pure parts: where the work and the camera land (layoutRects),
// output sizes (PRESETS), which file type MediaRecorder writes (pickMime), the event log,
// and the Recorder's chunk bookkeeping against a fake MediaRecorder.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  LAYOUTS, PRESETS, presetById, resolveSize, layoutRects, framePoint, recommendedFps, recommendedBitrate,
} from '../packages/record/layout.js';
import { pickMime, extFor, VIDEO_MIMES, AUDIO_MIMES } from '../packages/record/mime.js';
import { EventLog, cleanValue } from '../packages/record/events.js';
import { Recorder } from '../packages/record/recorder.js';
import { cameraConstraints } from '../packages/record/camera.js';
import { Signals } from '../packages/core/index.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const inside = (r, W, H) => r.x >= 0 && r.y >= 0 && r.x + r.w <= W && r.y + r.h <= H;
const ints = (r) => [r.x, r.y, r.w, r.h].every(Number.isInteger);
const near = (a, b, eps = 1e-6) => Math.abs(a - b) <= eps;
const CAM = { camW: 1920, camH: 1080 };

// ───────────── layoutRects ─────────────

test('stack: a square work on top, the camera fills the bottom (1080×1920)', () => {
  const r = layoutRects('stack', { w: 1080, h: 1920 }, { workW: 1080, workH: 1080, ...CAM });
  assert.deepEqual([r.work.x, r.work.y, r.work.w, r.work.h], [0, 0, 1080, 1080]);
  assert.equal(r.work.crop, null);
  assert.deepEqual([r.cam.x, r.cam.y, r.cam.w, r.cam.h], [0, 1080, 1080, 840]);
  // cover crop: same aspect as the area, centered, inside the camera frame
  const c = r.cam.crop;
  assert.ok(near(c.w / c.h, 1080 / 840, 1e-9));
  assert.ok(c.x >= 0 && c.y >= 0 && c.x + c.w <= 1920 + 1e-9 && c.y + c.h <= 1080 + 1e-9);
  assert.ok(near(c.x, (1920 - c.w) / 2) && near(c.y, 0));
  // the whole camera frame (for overlays) is wider than the visible area and centered on it
  assert.ok(r.cam.frame.x < 0 && near(r.cam.frame.x * 2 + r.cam.frame.w, 1080, 1e-6));
  assert.ok(near(r.cam.frame.h, 840) && near(r.cam.frame.y, 1080));
});

test('stack: every vertical preset tiles the frame exactly, no seam, no overlap', () => {
  for (const p of PRESETS.filter((x) => x.group === 'vertical')) {
    const r = layoutRects('stack', p, { workW: 1000, workH: 1000, ...CAM });
    assert.equal(r.work.w, p.w, p.id);
    assert.equal(r.work.h, p.w, p.id + ': square work at full width');
    assert.equal(r.cam.y, r.work.y + r.work.h, p.id);
    assert.equal(r.cam.y + r.cam.h, p.h, p.id);
    assert.ok(ints(r.work) && ints(r.cam), p.id);
  }
});

test('stack: odd output sizes stay integer and seamless', () => {
  for (const out of [{ w: 1081, h: 1921 }, { w: 777, h: 1333 }, { w: 3, h: 7 }]) {
    const r = layoutRects('stack', out, { workW: 501, workH: 499, camW: 641, camH: 479 });
    assert.ok(ints(r.work) && ints(r.cam), JSON.stringify(out));
    assert.ok(inside(r.work, out.w, out.h) && inside(r.cam, out.w, out.h));
    assert.equal(r.cam.y + r.cam.h, out.h);
    assert.ok(r.cam.y >= r.work.y + r.work.h);
  }
});

test('stack: a non-square work keeps its aspect at full width (16:9 work → 1080×608)', () => {
  const r = layoutRects('stack', { w: 1080, h: 1920 }, { workW: 1920, workH: 1080, ...CAM });
  assert.deepEqual([r.work.w, r.work.h], [1080, 608]);
  assert.deepEqual([r.cam.y, r.cam.h], [608, 1312]);
});

test('stack degrades when the frame is not tall enough: split, work contained', () => {
  // square output: a square work would leave no room — share the height (60/40)
  const sq = layoutRects('stack', { w: 1080, h: 1080 }, { workW: 1, workH: 1, ...CAM });
  assert.equal(sq.work.box.h, 648);
  assert.deepEqual([sq.work.w, sq.work.h, sq.work.x], [648, 648, 216], 'contained and centered');
  assert.deepEqual([sq.cam.y, sq.cam.h, sq.cam.w], [648, 432, 1080]);
  // landscape output, custom split
  const ls = layoutRects('stack', { w: 1920, h: 1080 }, { workW: 1, workH: 1, ...CAM }, { split: 0.5 });
  assert.equal(ls.work.box.h, 540);
  assert.equal(ls.cam.h, 540);
  // 4:5 sits exactly at the 20% threshold: still the full-width square
  const p45 = layoutRects('stack', { w: 1440, h: 1800 }, { workW: 1, workH: 1, ...CAM });
  assert.deepEqual([p45.work.h, p45.cam.h], [1440, 360]);
});

test('side: square work on the left at full height, camera fills the right', () => {
  const r = layoutRects('side', { w: 1920, h: 1080 }, { workW: 800, workH: 800, ...CAM });
  assert.deepEqual([r.work.x, r.work.y, r.work.w, r.work.h], [0, 0, 1080, 1080]);
  assert.deepEqual([r.cam.x, r.cam.y, r.cam.w, r.cam.h], [1080, 0, 840, 1080]);
  assert.ok(near(r.cam.crop.w / r.cam.crop.h, 840 / 1080, 1e-9));
  // a portrait frame cannot fit a full-height square beside a camera → split
  const tall = layoutRects('side', { w: 1080, h: 1920 }, { workW: 1, workH: 1, ...CAM });
  assert.equal(tall.work.box.w, 648);
  assert.equal(tall.cam.x + tall.cam.w, 1080);
});

test('pip: work fills the frame, camera is a rounded corner inset in any corner', () => {
  const out = { w: 1080, h: 1920 };
  const r = layoutRects('pip', out, { workW: 1, workH: 1, ...CAM });
  assert.deepEqual([r.work.x, r.work.y, r.work.w, r.work.h], [0, 420, 1080, 1080], 'contain: letterboxed top and bottom');
  assert.equal(r.cam.w, 324);
  assert.equal(r.cam.h, 182);   // the camera's own 16:9 aspect
  const m = Math.round(0.03 * 1080);
  assert.deepEqual([r.cam.x, r.cam.y], [1080 - m - 324, 1920 - m - 182], 'bottom-right by default');
  assert.ok(r.cam.radius > 0);
  for (const corner of ['tl', 'tr', 'bl', 'br']) {
    const c = layoutRects('pip', out, CAM, { pip: { corner, size: 0.4, aspect: 1 } }).cam;
    assert.equal(c.w, c.h, 'aspect 1 → square inset');
    assert.ok(inside(c, out.w, out.h), corner);
    assert.equal(c.x < out.w / 2, corner[1] === 'l', corner);
    assert.equal(c.y < out.h / 2, corner[0] === 't', corner);
    assert.ok(near(c.crop.w, c.crop.h), 'square crop out of a 16:9 camera');
  }
  // a huge inset never leaves the frame
  const big = layoutRects('pip', { w: 1920, h: 1080 }, { camW: 480, camH: 1080 }, { pip: { size: 1 } }).cam;
  assert.ok(inside(big, 1920, 1080));
});

test('work: contain letterboxes, cover crops; cam is null', () => {
  const c = layoutRects('work', { w: 1920, h: 1080 }, { workW: 1000, workH: 1000 });
  assert.deepEqual([c.work.x, c.work.y, c.work.w, c.work.h], [420, 0, 1080, 1080]);
  assert.equal(c.cam, null);
  const v = layoutRects('work', { w: 1920, h: 1080 }, { workW: 1000, workH: 1000 }, { fit: 'cover' });
  assert.deepEqual([v.work.x, v.work.y, v.work.w, v.work.h], [0, 0, 1920, 1080]);
  assert.ok(near(v.work.crop.w, 1000) && near(v.work.crop.h, 562.5) && near(v.work.crop.y, 218.75));
});

test('no camera yet: its area is reserved (stable frame), crop and frame are null', () => {
  const a = layoutRects('stack', { w: 1080, h: 1920 }, { workW: 1, workH: 1 });
  const b = layoutRects('stack', { w: 1080, h: 1920 }, { workW: 1, workH: 1, ...CAM });
  assert.deepEqual([a.cam.x, a.cam.y, a.cam.w, a.cam.h], [b.cam.x, b.cam.y, b.cam.w, b.cam.h]);
  assert.equal(a.cam.crop, null);
  assert.equal(a.cam.frame, null);
  assert.equal(framePoint(a.cam, 0.5, 0.5), null);
  // unknown work size counts as square
  const u = layoutRects('stack', { w: 1080, h: 1920 }, {});
  assert.equal(u.work.h, 1080);
});

test('camera options: anchor picks which part survives the crop; contain letterboxes it', () => {
  const left = layoutRects('stack', { w: 1080, h: 1920 }, { ...CAM }, { camAnchor: { x: 0, y: 0.5 } });
  const right = layoutRects('stack', { w: 1080, h: 1920 }, { ...CAM }, { camAnchor: { x: 1, y: 0.5 } });
  assert.equal(left.cam.crop.x, 0);
  assert.ok(near(right.cam.crop.x + right.cam.crop.w, 1920));
  const con = layoutRects('stack', { w: 1080, h: 1920 }, { ...CAM }, { camFit: 'contain' });
  assert.deepEqual([con.cam.w, con.cam.h], [1080, 608]);
  assert.deepEqual(con.cam.crop, { x: 0, y: 0, w: 1920, h: 1080 });
  assert.ok(con.cam.y >= 1080 && con.cam.y + con.cam.h <= 1920);
});

test('framePoint maps normalized camera coordinates through the crop', () => {
  const r = layoutRects('stack', { w: 1080, h: 1920 }, { ...CAM });
  const center = framePoint(r.cam, 0.5, 0.5);
  assert.ok(near(center.x, 540, 1e-6) && near(center.y, 1080 + 420, 1e-6));
  const top = framePoint(r.cam, 0.5, 0);
  assert.ok(near(top.y, 1080));
});

test('layoutRects rejects nonsense loudly', () => {
  assert.throws(() => layoutRects('grid', { w: 10, h: 10 }), /unknown layout/);
  assert.throws(() => layoutRects('stack', { w: 0, h: 10 }), /positive/);
  assert.throws(() => layoutRects('stack', null), /positive/);
  assert.deepEqual([...LAYOUTS].sort(), ['pip', 'side', 'stack', 'work']);
});

// ───────────── presets, fps, bitrate, sizes ─────────────

test('PRESETS: the sizes asked for, even dimensions, unique ids, honest groups', () => {
  const want = ['1080x1920', '1440x1800', '1520x2704', '2160x3840', '1920x1080', '1920x1200', '2704x1520', '3840x2160', '1080x1080', '2048x2048', '2160x2160'];
  assert.deepEqual(PRESETS.map((p) => `${p.w}x${p.h}`), want);
  assert.equal(new Set(PRESETS.map((p) => p.id)).size, PRESETS.length);
  for (const p of PRESETS) {
    assert.ok(p.w % 2 === 0 && p.h % 2 === 0, `${p.id}: even (4:2:0 encoders)`);
    assert.equal(p.group, p.w === p.h ? 'square' : p.h > p.w ? 'vertical' : 'landscape', p.id);
    assert.ok(p.label.includes(`${p.w}×${p.h}`) && p.labelZh.includes(`${p.w}×${p.h}`), p.id);
    assert.ok(LAYOUTS.includes(p.layout));
    assert.equal(p.fps, recommendedFps(p.w, p.h));
    assert.ok(Object.isFrozen(p));
    assert.equal(presetById(p.id), p);
  }
  assert.ok(Object.isFrozen(PRESETS));
  assert.equal(presetById('nope'), null);
});

test('recommended fps: 60 up to ~1080×1920, 30 for 2.7K and 4K', () => {
  assert.equal(recommendedFps(1080, 1920), 60);
  assert.equal(recommendedFps(1440, 1800), 60);
  assert.equal(recommendedFps(1920, 1200), 60);
  assert.equal(recommendedFps(1520, 2704), 30);
  assert.equal(recommendedFps(2704, 1520), 30);
  assert.equal(recommendedFps(2160, 3840), 30);
  assert.equal(recommendedFps(2048, 2048), 30);
});

test('recommended bitrate: ~0.12 bit/px/frame, clamped, in 0.1 Mb/s steps', () => {
  assert.equal(recommendedBitrate(1080, 1920, 60), 14900000);
  assert.equal(recommendedBitrate(3840, 2160, 30), 29900000);
  assert.equal(recommendedBitrate(10, 10, 30), 4e6);
  assert.equal(recommendedBitrate(8000, 8000, 60), 80e6);
  assert.equal(recommendedBitrate(1080, 1920), recommendedBitrate(1080, 1920, 60));
});

test('resolveSize: preset ids, WxH strings, arrays, objects — rounded up to even', () => {
  assert.deepEqual(resolveSize('vertical-4k'), { w: 2160, h: 3840 });
  assert.deepEqual(resolveSize('1280x720'), { w: 1280, h: 720 });
  assert.deepEqual(resolveSize('1081×1921'), { w: 1082, h: 1922 });
  assert.deepEqual(resolveSize([999, 500]), { w: 1000, h: 500 });
  assert.deepEqual(resolveSize({ w: 640.4, h: 359.6 }), { w: 640, h: 360 });
  assert.throws(() => resolveSize('huge'), /unknown size/);
  assert.throws(() => resolveSize({ w: -1, h: 5 }), /unknown size/);
});

// ───────────── mime ─────────────

test('pickMime: first supported candidate, in order', () => {
  const chrome154 = new Set(['video/mp4;codecs=avc1.640033,mp4a.40.2', 'video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm', 'video/mp4']);
  assert.equal(pickMime((m) => chrome154.has(m)), 'video/mp4;codecs=avc1.640033,mp4a.40.2');
  assert.equal(pickMime((m) => m === 'video/mp4;codecs=avc1,mp4a' || m === 'video/webm'), 'video/mp4;codecs=avc1,mp4a');
  const firefox = new Set(['video/webm;codecs=vp8,opus', 'video/webm']);
  assert.equal(pickMime((m) => firefox.has(m)), 'video/webm;codecs=vp8,opus');
  assert.equal(pickMime((m) => m === 'video/mp4'), 'video/mp4', 'Safari');
  assert.equal(pickMime(() => false), '');
  assert.equal(pickMime(null), '');
  assert.equal(pickMime(() => { throw new Error('x'); }), '', 'a throwing check counts as no');
});

test('pickMime: prefer a container, audio-only list, custom candidates', () => {
  assert.equal(pickMime(() => true, { prefer: 'webm' }), 'video/webm;codecs=vp9,opus');
  assert.equal(pickMime(() => true), VIDEO_MIMES[0]);
  assert.equal(pickMime(() => true, { audioOnly: true }), 'audio/mp4;codecs=mp4a.40.2');
  assert.equal(pickMime((m) => m.startsWith('audio/webm'), { audioOnly: true }), 'audio/webm;codecs=opus');
  assert.equal(pickMime(() => true, { audioOnly: true, prefer: 'webm' }), 'audio/webm;codecs=opus');
  assert.equal(pickMime((m) => m === 'b', { candidates: ['a', 'b'] }), 'b');
  assert.ok(VIDEO_MIMES.every((m) => m.startsWith('video/')) && AUDIO_MIMES.every((m) => m.startsWith('audio/')));
});

test('extFor: the file extension a recording should get', () => {
  assert.equal(extFor('video/mp4;codecs=avc1.640033,mp4a.40.2'), 'mp4');
  assert.equal(extFor('audio/mp4;codecs=mp4a.40.2'), 'm4a');
  assert.equal(extFor('video/webm;codecs=vp9,opus'), 'webm');
  assert.equal(extFor('audio/webm;codecs=opus'), 'webm');
  assert.equal(extFor('audio/ogg;codecs=opus'), 'ogg');
  assert.equal(extFor('video/x-matroska;codecs=avc1'), 'mkv');
  assert.equal(extFor(''), 'bin');
  assert.equal(extFor(undefined), 'bin');
});

// ───────────── camera constraints ─────────────

test('cameraConstraints: ideal 1920×1080@30, exact device when chosen', () => {
  assert.deepEqual(cameraConstraints(), { video: { width: { ideal: 1920 }, height: { ideal: 1080 }, frameRate: { ideal: 30 } }, audio: false });
  const c = cameraConstraints({ deviceId: 'abc', width: 1280, height: 720, fps: 60, facingMode: 'user' });
  assert.deepEqual(c.video.deviceId, { exact: 'abc' });
  assert.equal(c.video.facingMode, undefined, 'a chosen device wins over facingMode');
  assert.deepEqual(c.video.frameRate, { ideal: 60 });
  assert.equal(cameraConstraints({ facingMode: 'environment' }).video.facingMode, 'environment');
});

// ───────────── EventLog ─────────────

const clock = (t = 0) => { const c = () => c.t; c.t = t; return c; };

test('EventLog: times are ms from start, on the injected clock; nothing before start or after stop', () => {
  const now = clock(1000);
  const log = new EventLog({ now });
  assert.equal(log.add('early', 1), null, 'not running yet');
  log.start();
  now.t = 1012.345; log.add('midi/note/on', { note: 60, vel: 0.5 });
  now.t = 1500; log.add('midi/note/off', { note: 60 });
  log.add('late', 1, { at: 900 });   // before t0 → ignored
  now.t = 2000; log.stop();
  now.t = 2100; assert.equal(log.add('after', 1), null);
  assert.deepEqual(log.events.map((e) => [e.t, e.name]), [[12.3, 'midi/note/on'], [500, 'midi/note/off']]);
  assert.equal(log.durationMs, 1000);
  assert.equal(log.running, false);
  assert.deepEqual(log.between(0, 500).map((e) => e.name), ['midi/note/on']);
});

test('EventLog: start(at) lines up with a recorder that started earlier', () => {
  const now = clock(5000);
  const log = new EventLog({ now }).start(4800);
  assert.equal(log.add('x', 1).t, 200);
});

test('EventLog.attach: pulses always, continuous throttled per name, filter applies', () => {
  const now = clock(0);
  const signals = new Signals();
  signals.define('midi/note/on', { kind: 'pulse' });
  signals.define('hand/right/x');
  const log = new EventLog({ now, throttleMs: 50, filter: (n) => !n.startsWith('audio/') });
  log.start();
  const off = log.attach(signals);
  for (let i = 0; i < 10; i++) { now.t = i * 10; signals.set('hand/right/x', i / 10); signals.pulse('midi/note/on', { note: 60 + i }); }
  signals.set('audio/rms', 0.4);
  const hands = log.events.filter((e) => e.name === 'hand/right/x');
  const notes = log.events.filter((e) => e.name === 'midi/note/on');
  assert.equal(notes.length, 10, 'pulses are never throttled');
  assert.deepEqual(hands.map((e) => e.t), [0, 50], 'one per 50 ms');
  assert.ok(!log.events.some((e) => e.name.startsWith('audio/')));
  off();
  signals.pulse('midi/note/on', { note: 1 });
  assert.equal(log.events.filter((e) => e.name === 'midi/note/on').length, 10, 'detached');
});

test('EventLog: JSON round trip, values made JSON-safe', () => {
  const now = clock(0);
  const log = new EventLog({ now }).start();
  now.t = 10; log.add('a', { note: 60, vel: 1 / 3, fn: () => 1, nested: { arr: new Float32Array([0.5, 0.25]) } });
  now.t = 20; log.mark('chorus');
  now.t = 30; log.stop();
  const json = JSON.parse(JSON.stringify(log));
  assert.equal(json.format, 'openav-eventlog');
  assert.equal(json.version, 1);
  assert.equal(json.count, 2);
  assert.equal(json.durationMs, 30);
  assert.ok(typeof json.startedAt === 'string');
  assert.deepEqual(json.events[0].value, { note: 60, vel: 0.333333, nested: { arr: [0.5, 0.25] } });
  assert.deepEqual(json.events[1], { t: 20, name: 'mark', value: { label: 'chorus' } });
  const back = EventLog.fromJSON(JSON.stringify(json));
  assert.deepEqual(back.events, log.events);
  assert.equal(back.durationMs, 30);
  assert.throws(() => EventLog.fromJSON({ events: [] }), /not an openav-eventlog/);
});

test('cleanValue: what survives into the log', () => {
  assert.equal(cleanValue(NaN), null);
  assert.equal(cleanValue(Infinity), null);
  assert.equal(cleanValue(undefined), null);
  assert.equal(cleanValue(0.1234567891), 0.123457);
  assert.deepEqual(cleanValue([1, 'a', null, () => 0]), [1, 'a', null, null]);
  assert.deepEqual(cleanValue({ a: undefined, b: null, c: true }), { b: null, c: true });
  assert.equal(cleanValue({ a: { b: { c: { d: { e: 1 } } } } }).a.b.c.d, null, 'depth limit');
  assert.equal(cleanValue(10n), 10);
});

// ───────────── Recorder against a fake MediaRecorder ─────────────

class FakeTrack { constructor(kind) { this.kind = kind; this.readyState = 'live'; } stop() { this.readyState = 'ended'; } }
class FakeStream {
  constructor(tracks = []) { this.tracks = tracks; }
  getTracks() { return this.tracks; }
  getVideoTracks() { return this.tracks.filter((t) => t.kind === 'video'); }
  getAudioTracks() { return this.tracks.filter((t) => t.kind === 'audio'); }
}
class FakeMR {
  static isTypeSupported(m) { return m.startsWith('video/webm') || m.startsWith('audio/webm'); }
  constructor(stream, opts) { this.stream = stream; this.opts = opts; this.state = 'inactive'; this.mimeType = opts.mimeType || 'video/webm'; FakeMR.last = this; }
  start(slice) { this.slice = slice; this.state = 'recording'; }
  emit(bytes) { this.ondataavailable({ data: new Blob([new Uint8Array(bytes)]) }); }
  stop() { this.state = 'inactive'; setTimeout(() => { this.emit(3); this.onstop(); }, 1); }
}

test('Recorder: picks a type, streams ordered chunks, waits for uploads, stops its own canvas track', async () => {
  const saved = { MR: globalThis.MediaRecorder, MS: globalThis.MediaStream };
  globalThis.MediaRecorder = FakeMR; globalThis.MediaStream = FakeStream;
  try {
    const vt = new FakeTrack('video'), at = new FakeTrack('audio');
    const canvas = { width: 1080, height: 1920, captureStream: (fps) => { canvas.fps = fps; return new FakeStream([vt]); } };
    const rec = new Recorder({ canvas, fps: 60, audioTracks: [at] });
    assert.equal(rec.mimeType, 'video/webm;codecs=vp9,opus');
    const got = [];
    rec.start({ timeslice: 500, ondata: async (blob, seq) => { await new Promise((r) => setTimeout(r, 5)); got.push([seq, blob.size]); } });
    assert.equal(canvas.fps, 60);
    assert.equal(FakeMR.last.slice, 500);
    assert.equal(FakeMR.last.opts.videoBitsPerSecond, recommendedBitrate(1080, 1920, 60));
    assert.deepEqual(FakeMR.last.stream.getTracks(), [vt, at], 'one stream: picture + sound');
    FakeMR.last.emit(10); FakeMR.last.emit(0); FakeMR.last.emit(20);
    const res = await rec.stop();
    assert.deepEqual(got, [[0, 10], [1, 20], [2, 3]], 'empty chunks skipped, order kept, all awaited');
    assert.equal(res.bytes, 33);
    assert.equal(res.chunks, 3);
    assert.equal(res.blob, null, 'streaming hosts do not keep chunks unless asked');
    assert.equal(res.ext, 'webm');
    assert.deepEqual([res.width, res.height, res.fps, res.audio], [1080, 1920, 60, true]);
    assert.equal(vt.readyState, 'ended', 'the capture track is ours to stop');
    assert.equal(at.readyState, 'live', 'the audio track is the tap\'s');
    assert.equal(await rec.stop(), res, 'stop twice → same result');

    const audio = new Recorder({ audioOnly: true, audioTracks: [at] });
    assert.equal(audio.mimeType, 'audio/webm;codecs=opus');
    audio.start();
    FakeMR.last.emit(7);
    const a = await audio.stop();
    assert.equal(a.blob.size, 10, 'kept by default');
    assert.equal(a.fps, 0);
    assert.throws(() => new Recorder({}), /canvas/);
    assert.throws(() => new Recorder({ audioOnly: true }).start(), /audio track/);
  } finally { globalThis.MediaRecorder = saved.MR; globalThis.MediaStream = saved.MS; }
});

// ───────────── classic-script safety (the lab bundles these files) ─────────────

test('record sources stay bundleable: relative imports only, no import.meta, no default export', () => {
  const dir = path.join(ROOT, 'packages/record');
  for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.js') && x !== 'lab.wire.js')) {
    const src = fs.readFileSync(path.join(dir, f), 'utf8');
    assert.doesNotMatch(src, /import\.meta/, f);
    assert.doesNotMatch(src, /^export\s+default/m, f);
    for (const m of src.matchAll(/^\s*import\s[\s\S]*?from\s+'([^']+)'/gm)) assert.match(m[1], /^\.\.?\//, `${f}: ${m[1]}`);
    for (const m of src.matchAll(/^export\s*\{([^}]*)\}/gm)) assert.doesNotMatch(m[1], /\sas\s/, `${f}: export { a as b } is not bundleable`);
  }
});
